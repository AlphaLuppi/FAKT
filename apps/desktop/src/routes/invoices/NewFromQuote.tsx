import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { tokens } from "@fakt/design-tokens";
import { Button, Select } from "@fakt/ui";
import { fr, addDays, today } from "@fakt/shared";
import type { Quote, UUID, DocumentUnit } from "@fakt/shared";
import { computeDepositAmount } from "@fakt/core";
import { buildLegalMentionsSnapshot } from "@fakt/legal";
import {
  InvoiceForm,
  type InvoiceFormValues,
  type EditableItem,
} from "../../features/doc-editor/index.js";
import { quotesApi } from "../../features/doc-editor/quotes-api.js";
import { invoiceApi } from "../../features/doc-editor/invoice-api.js";
import type { CreateFromQuoteMode } from "../../features/doc-editor/invoice-api.js";
import { useClientsList, usePrestationsList, useWorkspace } from "../quotes/hooks.js";
import { invalidateSearchIndex } from "../../components/command-palette/useCommandPaletteIndex.js";

function newId(): UUID {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `tmp-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function computeDepositItems(quote: Quote): EditableItem[] {
  const depositCents = computeDepositAmount(quote.totalHtCents, 30);
  return [
    {
      id: newId(),
      position: 0,
      description: fr.invoices.form.depositLabel(
        quote.number ?? quote.id.slice(0, 6),
      ),
      quantity: 1000,
      unitPriceCents: depositCents,
      unit: "forfait" as DocumentUnit,
      lineTotalCents: depositCents,
      serviceId: null,
    },
  ];
}

function computeTotalItems(quote: Quote): EditableItem[] {
  return quote.items.map((item, idx) => ({
    id: newId(),
    position: idx,
    description: item.description,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    unit: item.unit,
    lineTotalCents: item.lineTotalCents,
    serviceId: item.serviceId,
  }));
}

async function computeBalanceItems(quote: Quote): Promise<EditableItem[]> {
  const existing = await invoiceApi.list({ quoteId: quote.id });
  const deposits = existing
    .filter((inv) => inv.kind === "deposit")
    .reduce((sum, inv) => sum + inv.totalHtCents, 0);
  const balance = Math.max(0, quote.totalHtCents - deposits);
  return [
    {
      id: newId(),
      position: 0,
      description: fr.invoices.form.balanceLabel(
        quote.number ?? quote.id.slice(0, 6),
      ),
      quantity: 1000,
      unitPriceCents: balance,
      unit: "forfait" as DocumentUnit,
      lineTotalCents: balance,
      serviceId: null,
    },
  ];
}

export function NewFromQuote(): ReactElement {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preselectedQuoteId = params.get("quoteId");
  const { clients } = useClientsList();
  const { prestations } = usePrestationsList();
  const { workspace } = useWorkspace();

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<UUID | null>(
    preselectedQuoteId ?? null,
  );
  const [mode, setMode] = useState<CreateFromQuoteMode>("deposit30");
  const [initialValues, setInitialValues] =
    useState<Partial<InvoiceFormValues>>();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadingQuotes, setLoadingQuotes] = useState(true);

  // Charge la liste des devis signés.
  useEffect(() => {
    let cancelled = false;
    setLoadingQuotes(true);
    quotesApi
      .list({ status: ["sent", "signed"] })
      .then((data) => {
        if (!cancelled) {
          setQuotes(data);
          setLoadingQuotes(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQuotes([]);
          setLoadingQuotes(false);
        }
      });
    return (): void => {
      cancelled = true;
    };
  }, []);

  const selectedQuote = useMemo(
    () => quotes.find((q) => q.id === selectedQuoteId) ?? null,
    [quotes, selectedQuoteId],
  );

  // Recalcule les items quand mode/quote change.
  useEffect(() => {
    if (!selectedQuote) {
      setInitialValues(undefined);
      return;
    }
    let cancelled = false;

    async function compute(quote: Quote): Promise<void> {
      let items: EditableItem[];
      if (mode === "deposit30") {
        items = computeDepositItems(quote);
      } else if (mode === "full") {
        items = computeTotalItems(quote);
      } else {
        items = await computeBalanceItems(quote);
      }
      if (cancelled) return;
      setInitialValues({
        clientId: quote.clientId,
        title: quote.title,
        issuedAt: today(),
        dueDate: addDays(today(), 30),
        items,
        paymentMethod: "wire",
        notes: "",
      });
    }

    void compute(selectedQuote);

    return (): void => {
      cancelled = true;
    };
  }, [selectedQuote, mode]);

  async function handleSubmit(
    values: InvoiceFormValues,
    issueNumber: boolean,
  ): Promise<void> {
    if (!selectedQuote) {
      setSubmitError(fr.invoices.errors.missingQuote);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const items = values.items.map((item, idx) => ({
        id:
          item.id.startsWith("tmp-") || item.id.startsWith("item-")
            ? newId()
            : item.id,
        position: idx,
        description: item.description,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        unit: item.unit as DocumentUnit,
        lineTotalCents: item.lineTotalCents,
        serviceId: item.serviceId,
      }));
      const totalHtCents = items.reduce((s, i) => s + i.lineTotalCents, 0);

      const legalMentions = workspace
        ? buildLegalMentionsSnapshot(
            {
              name: workspace.name,
              legalForm: workspace.legalForm,
              siret: workspace.siret,
              address: workspace.address,
              iban: workspace.iban,
              tvaMention: workspace.tvaMention,
            },
            30,
          )
        : "";

      const created = await invoiceApi.createFromQuote({
        quoteId: selectedQuote.id,
        mode,
        title: values.title.trim(),
        dueDate: values.dueDate,
        paymentMethod: values.paymentMethod,
        legalMentions,
        items,
        totalHtCents,
        issueNumber,
      });

      if (mode === "full" && issueNumber) {
        try {
          await quotesApi.updateStatus(selectedQuote.id, "invoiced");
        } catch {
          // Transition secondaire : ne pas bloquer la redirection si elle échoue
          // (ex. devis déjà invoiced ou statut non transitionnable). Le devis
          // restera consultable dans la liste pour correction manuelle.
        }
      }

      invalidateSearchIndex();
      void navigate(`/invoices/${created.id}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : fr.invoices.errors.createFailed,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        padding: tokens.spacing[6],
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacing[5],
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: tokens.spacing[4],
        }}
      >
        <div>
          <h1
            style={{
              font: `var(--w-black) var(--t-2xl)/1 ${tokens.font.ui}`,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              color: tokens.color.ink,
              margin: 0,
            }}
          >
            {fr.invoices.new}
          </h1>
          <p
            style={{
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.sm,
              color: tokens.color.muted,
              marginTop: tokens.spacing[1],
              marginBottom: 0,
            }}
          >
            {fr.invoices.modes.fromQuote}
          </p>
        </div>
        <Button variant="ghost" onClick={() => void navigate("/invoices")}>
          {fr.invoices.actions.backToList}
        </Button>
      </header>

      {!preselectedQuoteId && (
        <section
          data-testid="quote-picker-section"
          style={{
            border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
            padding: tokens.spacing[5],
            background: tokens.color.surface,
            boxShadow: tokens.shadow.sm,
            display: "flex",
            flexDirection: "column",
            gap: tokens.spacing[3],
          }}
        >
          <h2
            style={{
              font: `${tokens.fontWeight.black} ${tokens.fontSize.md}/1 ${tokens.font.ui}`,
              textTransform: "uppercase",
              letterSpacing: "-0.01em",
              margin: 0,
            }}
          >
            {fr.invoices.form.selectQuote}
          </h2>
          <p
            style={{
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.sm,
              color: tokens.color.muted,
              margin: 0,
            }}
          >
            {fr.invoices.form.selectQuoteHint}
          </p>
          {loadingQuotes ? (
            <div
              style={{
                fontFamily: tokens.font.ui,
                color: tokens.color.muted,
              }}
            >
              Chargement…
            </div>
          ) : quotes.length === 0 ? (
            <div
              data-testid="no-signed-quote"
              style={{
                fontFamily: tokens.font.ui,
                color: tokens.color.muted,
                fontSize: tokens.fontSize.sm,
              }}
            >
              {fr.invoices.form.noSignedQuote}
            </div>
          ) : (
            <Select
              aria-label={fr.invoices.form.selectQuote}
              options={quotes.map((q) => ({
                value: q.id,
                label: `${q.number ?? "—"} · ${q.title}`,
              }))}
              value={selectedQuoteId ?? ""}
              onChange={(e) => setSelectedQuoteId(e.target.value || null)}
              data-testid="quote-picker"
            />
          )}
        </section>
      )}

      {selectedQuote && (
        <>
          <section
            data-testid="mode-picker-section"
            style={{
              border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
              padding: tokens.spacing[5],
              background: tokens.color.surface,
              boxShadow: tokens.shadow.sm,
              display: "flex",
              flexDirection: "column",
              gap: tokens.spacing[3],
            }}
          >
            <h2
              style={{
                font: `${tokens.fontWeight.black} ${tokens.fontSize.md}/1 ${tokens.font.ui}`,
                textTransform: "uppercase",
                letterSpacing: "-0.01em",
                margin: 0,
              }}
            >
              {fr.invoices.form.chooseMode}
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: tokens.spacing[3],
              }}
            >
              <ModeRadio
                mode="deposit30"
                label={fr.invoices.kindRadios.deposit30}
                hint={fr.invoices.kindRadios.deposit30Hint}
                current={mode}
                onChange={setMode}
              />
              <ModeRadio
                mode="balance"
                label={fr.invoices.kindRadios.balance}
                hint={fr.invoices.kindRadios.balanceHint}
                current={mode}
                onChange={setMode}
              />
              <ModeRadio
                mode="full"
                label={fr.invoices.kindRadios.full}
                hint={fr.invoices.kindRadios.fullHint}
                current={mode}
                onChange={setMode}
              />
            </div>
          </section>

          <InvoiceForm
            initial={initialValues}
            onSubmit={handleSubmit}
            onCancel={() => void navigate("/invoices")}
            submitting={submitting}
            submitError={submitError}
            kind="from-quote"
            clientLocked
            clients={clients}
            prestations={prestations}
            contextNote={`Devis lié : ${selectedQuote.number ?? selectedQuote.id.slice(0, 6)}`}
          />
        </>
      )}
    </div>
  );
}

interface ModeRadioProps {
  mode: CreateFromQuoteMode;
  current: CreateFromQuoteMode;
  label: string;
  hint: string;
  onChange: (m: CreateFromQuoteMode) => void;
}

function ModeRadio(props: ModeRadioProps): ReactElement {
  const { mode, current, label, hint, onChange } = props;
  const active = current === mode;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => onChange(mode)}
      data-testid={`mode-radio-${mode}`}
      style={{
        textAlign: "left",
        padding: tokens.spacing[3],
        border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
        background: active ? tokens.color.ink : tokens.color.surface,
        color: active ? tokens.color.accentSoft : tokens.color.ink,
        cursor: "pointer",
        boxShadow: active ? "none" : tokens.shadow.sm,
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacing[1],
      }}
    >
      <span
        style={{
          fontFamily: tokens.font.ui,
          fontSize: tokens.fontSize.sm,
          fontWeight: Number(tokens.fontWeight.black),
          textTransform: "uppercase",
          letterSpacing: "-0.01em",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: tokens.font.ui,
          fontSize: tokens.fontSize.xs,
          opacity: 0.85,
        }}
      >
        {hint}
      </span>
    </button>
  );
}
