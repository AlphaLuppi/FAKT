import { computeDepositAmount } from "@fakt/core";
import { tokens } from "@fakt/design-tokens";
import { buildLegalMentionsSnapshot } from "@fakt/legal";
import { addDays, formatEur, fr, today } from "@fakt/shared";
import type { DocumentUnit, Invoice, Quote, UUID } from "@fakt/shared";
import { Button, Modal } from "@fakt/ui";
import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { invalidateSearchIndex } from "../../components/command-palette/useCommandPaletteIndex.js";
import {
  type EditableItem,
  InvoiceForm,
  type InvoiceFormValues,
} from "../../features/doc-editor/index.js";
import { invoiceApi } from "../../features/doc-editor/invoice-api.js";
import type { CreateFromQuoteMode } from "../../features/doc-editor/invoice-api.js";
import { quotesApi } from "../../features/doc-editor/quotes-api.js";
import { useClientsList, usePrestationsList, useWorkspace } from "../quotes/hooks.js";

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
      description: fr.invoices.form.depositLabel(quote.number ?? quote.id.slice(0, 6)),
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
      description: fr.invoices.form.balanceLabel(quote.number ?? quote.id.slice(0, 6)),
      quantity: 1000,
      unitPriceCents: balance,
      unit: "forfait" as DocumentUnit,
      lineTotalCents: balance,
      serviceId: null,
    },
  ];
}

type BillingState = "unbilled" | "deposit-paid";
type FilterMode = "all" | "unbilled" | "deposit-paid";

function computeBillingState(quoteId: UUID, invoices: ReadonlyArray<Invoice>): BillingState | "billed" {
  // Une facture "active" = non annulée. On considère draft + sent + paid + overdue.
  const linked = invoices.filter((i) => i.quoteId === quoteId && i.status !== "cancelled");
  const hasFinal = linked.some((i) => i.kind === "total" || i.kind === "balance");
  if (hasFinal) return "billed";
  const hasDeposit = linked.some((i) => i.kind === "deposit");
  if (hasDeposit) return "deposit-paid";
  return "unbilled";
}

export function NewFromQuote(): ReactElement {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preselectedQuoteId = params.get("quoteId");
  const { clients } = useClientsList();
  const { prestations } = usePrestationsList();
  const { workspace } = useWorkspace();

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<UUID | null>(preselectedQuoteId ?? null);
  const [mode, setMode] = useState<CreateFromQuoteMode>("deposit30");
  const [initialValues, setInitialValues] = useState<Partial<InvoiceFormValues>>();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filter, setFilter] = useState<FilterMode>("all");

  // Charge les devis signés et toutes les factures pour calculer le billing state.
  useEffect(() => {
    let cancelled = false;
    setLoadingQuotes(true);
    Promise.all([quotesApi.list({ status: "signed" }), invoiceApi.list({})])
      .then(([qs, invs]) => {
        if (cancelled) return;
        setQuotes(qs);
        setAllInvoices(invs);
        setLoadingQuotes(false);
        // Auto-sélectionne le 1er devis éligible si rien n'est pré-sélectionné.
        setSelectedQuoteId((current) => {
          if (current) return current;
          const eligible = qs.find((q) => computeBillingState(q.id, invs) !== "billed");
          return eligible?.id ?? null;
        });
      })
      .catch(() => {
        if (cancelled) return;
        setQuotes([]);
        setAllInvoices([]);
        setLoadingQuotes(false);
      });
    return (): void => {
      cancelled = true;
    };
  }, []);

  const billingByQuote = useMemo((): Map<UUID, BillingState | "billed"> => {
    const m = new Map<UUID, BillingState | "billed">();
    for (const q of quotes) m.set(q.id, computeBillingState(q.id, allInvoices));
    return m;
  }, [quotes, allInvoices]);

  // Devis éligibles : signés ET pas encore facturés totalement.
  const eligibleQuotes = useMemo(
    () => quotes.filter((q) => billingByQuote.get(q.id) !== "billed"),
    [quotes, billingByQuote]
  );

  // Devis éligibles filtrés selon le filtre actif (modal picker).
  const filteredQuotes = useMemo(() => {
    if (filter === "all") return eligibleQuotes;
    return eligibleQuotes.filter((q) => billingByQuote.get(q.id) === filter);
  }, [eligibleQuotes, billingByQuote, filter]);

  const selectedQuote = useMemo(
    () => quotes.find((q) => q.id === selectedQuoteId) ?? null,
    [quotes, selectedQuoteId]
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

  async function handleSubmit(values: InvoiceFormValues, issueNumber: boolean): Promise<void> {
    // Guard synchrone double-submit.
    if (submitting) return;
    if (!selectedQuote) {
      setSubmitError(fr.invoices.errors.missingQuote);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const items = values.items.map((item, idx) => ({
        id: item.id.startsWith("tmp-") || item.id.startsWith("item-") ? newId() : item.id,
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
            30
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
      setSubmitError(err instanceof Error ? err.message : fr.invoices.errors.createFailed);
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
        <Button
          variant="ghost"
          onClick={() => void navigate("/invoices")}
          data-testid="invoice-new-from-quote-back"
        >
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
          ) : eligibleQuotes.length === 0 ? (
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
            <QuotePickerTrigger
              selected={selectedQuote}
              billingState={selectedQuote ? billingByQuote.get(selectedQuote.id) ?? null : null}
              onOpen={() => setPickerOpen(true)}
            />
          )}
        </section>
      )}

      <QuotePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        quotes={filteredQuotes}
        billingByQuote={billingByQuote}
        filter={filter}
        onFilterChange={setFilter}
        selectedId={selectedQuoteId}
        onSelect={(id) => {
          setSelectedQuoteId(id);
          setPickerOpen(false);
        }}
      />

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

interface QuotePickerTriggerProps {
  selected: Quote | null;
  billingState: BillingState | "billed" | null;
  onOpen: () => void;
}

function QuotePickerTrigger(props: QuotePickerTriggerProps): ReactElement {
  const { selected, billingState, onOpen } = props;
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="quote-picker-trigger"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: tokens.spacing[3],
        padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
        border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
        background: tokens.color.surface,
        boxShadow: tokens.shadow.sm,
        cursor: "pointer",
        textAlign: "left",
        fontFamily: tokens.font.ui,
        color: tokens.color.ink,
      }}
    >
      {selected ? (
        <span
          style={{
            display: "flex",
            flexDirection: "column",
            gap: tokens.spacing[1],
            minWidth: 0,
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: tokens.spacing[2],
            }}
          >
            <span
              style={{
                fontFamily: tokens.font.mono,
                fontSize: tokens.fontSize.sm,
                fontWeight: Number(tokens.fontWeight.bold),
              }}
            >
              {selected.number ?? "—"}
            </span>
            <BillingBadge state={billingState} />
          </span>
          <span
            style={{
              fontSize: tokens.fontSize.sm,
              fontWeight: Number(tokens.fontWeight.med),
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {selected.title} · {formatEur(selected.totalHtCents)}
          </span>
        </span>
      ) : (
        <span
          style={{
            fontSize: tokens.fontSize.sm,
            fontWeight: Number(tokens.fontWeight.bold),
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {fr.invoices.form.pickerOpen}
        </span>
      )}
      <span
        style={{
          fontFamily: tokens.font.ui,
          fontSize: tokens.fontSize.xs,
          fontWeight: Number(tokens.fontWeight.bold),
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
          border: `${tokens.stroke.hair} solid ${tokens.color.ink}`,
        }}
      >
        {selected ? fr.invoices.form.pickerChange : "▾"}
      </span>
    </button>
  );
}

interface QuotePickerModalProps {
  open: boolean;
  onClose: () => void;
  quotes: ReadonlyArray<Quote>;
  billingByQuote: Map<UUID, BillingState | "billed">;
  filter: FilterMode;
  onFilterChange: (f: FilterMode) => void;
  selectedId: UUID | null;
  onSelect: (id: UUID) => void;
}

function QuotePickerModal(props: QuotePickerModalProps): ReactElement {
  const { open, onClose, quotes, billingByQuote, filter, onFilterChange, selectedId, onSelect } =
    props;

  const filters: ReadonlyArray<{ value: FilterMode; label: string }> = [
    { value: "all", label: fr.invoices.form.pickerFilterAll },
    { value: "unbilled", label: fr.invoices.form.pickerFilterUnbilled },
    { value: "deposit-paid", label: fr.invoices.form.pickerFilterDeposit },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={fr.invoices.form.selectQuote}
      size="lg"
      data-testid="quote-picker-modal"
      testIdClose="quote-picker-modal-close"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: tokens.spacing[4],
        }}
      >
        <div
          role="radiogroup"
          aria-label={fr.invoices.form.selectQuote}
          style={{
            display: "flex",
            gap: tokens.spacing[2],
            flexWrap: "wrap",
          }}
        >
          {filters.map((f) => {
            const active = filter === f.value;
            return (
              <button
                type="button"
                key={f.value}
                role="radio"
                aria-checked={active}
                onClick={() => onFilterChange(f.value)}
                data-testid={`quote-picker-filter-${f.value}`}
                style={{
                  padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                  border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
                  background: active ? tokens.color.ink : tokens.color.surface,
                  color: active ? tokens.color.accentSoft : tokens.color.ink,
                  fontFamily: tokens.font.ui,
                  fontSize: tokens.fontSize.xs,
                  fontWeight: Number(tokens.fontWeight.bold),
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  cursor: "pointer",
                  boxShadow: active ? "none" : tokens.shadow.sm,
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {quotes.length === 0 ? (
          <div
            data-testid="quote-picker-empty"
            style={{
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.sm,
              color: tokens.color.muted,
              padding: tokens.spacing[4],
              textAlign: "center",
              border: `${tokens.stroke.hair} dashed ${tokens.color.muted}`,
            }}
          >
            {fr.invoices.form.pickerEmpty}
          </div>
        ) : (
          <ul
            data-testid="quote-picker-list"
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: tokens.spacing[2],
              maxHeight: 420,
              overflowY: "auto",
            }}
          >
            {quotes.map((q) => {
              const active = q.id === selectedId;
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(q.id)}
                    data-testid={`quote-picker-row-${q.id}`}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: tokens.spacing[3],
                      padding: tokens.spacing[3],
                      border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
                      background: active ? tokens.color.accentSoft : tokens.color.surface,
                      boxShadow: active ? "none" : tokens.shadow.sm,
                      textAlign: "left",
                      cursor: "pointer",
                      fontFamily: tokens.font.ui,
                      color: tokens.color.ink,
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: tokens.spacing[1],
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: tokens.spacing[2],
                        }}
                      >
                        <span
                          style={{
                            fontFamily: tokens.font.mono,
                            fontSize: tokens.fontSize.sm,
                            fontWeight: Number(tokens.fontWeight.bold),
                          }}
                        >
                          {q.number ?? "—"}
                        </span>
                        <BillingBadge state={billingByQuote.get(q.id) ?? null} />
                      </span>
                      <span
                        style={{
                          fontSize: tokens.fontSize.sm,
                          fontWeight: Number(tokens.fontWeight.med),
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {q.title}
                      </span>
                    </span>
                    <span
                      style={{
                        fontFamily: tokens.font.mono,
                        fontSize: tokens.fontSize.sm,
                        fontWeight: Number(tokens.fontWeight.bold),
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatEur(q.totalHtCents)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function BillingBadge({
  state,
}: {
  state: BillingState | "billed" | null;
}): ReactElement | null {
  if (state === null || state === "billed") return null;
  const label =
    state === "deposit-paid"
      ? fr.invoices.form.pickerBadgeDeposit
      : fr.invoices.form.pickerBadgeUnbilled;
  const isDeposit = state === "deposit-paid";
  return (
    <span
      data-testid={`billing-badge-${state}`}
      style={{
        fontFamily: tokens.font.ui,
        fontSize: tokens.fontSize.xs,
        fontWeight: Number(tokens.fontWeight.bold),
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
        border: `${tokens.stroke.hair} solid ${tokens.color.ink}`,
        background: isDeposit ? tokens.color.accentSoft : tokens.color.surface,
        color: tokens.color.ink,
      }}
    >
      {label}
    </span>
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
