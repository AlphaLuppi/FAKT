import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import { tokens } from "@fakt/design-tokens";
import { Button, Input, Textarea } from "@fakt/ui";
import {
  fr,
  formatEur,
  formatFrDate,
  addDays,
  today,
} from "@fakt/shared";
import type { Quote, UUID } from "@fakt/shared";
import { computeLinesTotal } from "@fakt/core";
import {
  ItemsEditor,
  ClientPicker,
  type EditableItem,
} from "../../features/doc-editor/index.js";
import { useClientsList, usePrestationsList } from "./hooks.js";

export interface QuoteFormValues {
  clientId: UUID | null;
  title: string;
  issuedAt: number;
  validityDate: number;
  notes: string;
  items: EditableItem[];
}

export interface QuoteFormProps {
  initial?: Partial<QuoteFormValues> | undefined;
  onSubmit: (values: QuoteFormValues, issueNumber: boolean) => Promise<void>;
  onCancel: () => void;
  submitting?: boolean | undefined;
  submitError?: string | null | undefined;
  /** Si true : mode édition (pas de bouton "Créer et attribuer"). */
  editMode?: boolean | undefined;
  /** Si true : masque les boutons Save (mode Detail). */
  readOnly?: boolean | undefined;
}

function initialFromPartial(
  partial: Partial<QuoteFormValues> | undefined,
): QuoteFormValues {
  const base: QuoteFormValues = {
    clientId: null,
    title: "",
    issuedAt: today(),
    validityDate: addDays(today(), 30),
    notes: "",
    items: [],
  };
  return { ...base, ...(partial ?? {}) };
}

export function QuoteForm(props: QuoteFormProps): ReactElement {
  const { initial, onSubmit, onCancel, submitting, submitError, editMode, readOnly } = props;
  const [values, setValues] = useState<QuoteFormValues>(() =>
    initialFromPartial(initial),
  );
  const [validityDays, setValidityDays] = useState<number>(() => {
    const v = initial?.validityDate;
    const i = initial?.issuedAt;
    if (typeof v === "number" && typeof i === "number") {
      return Math.max(1, Math.round((v - i) / 86400000));
    }
    return 30;
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [quickClientModal, setQuickClientModal] = useState(false);

  const { clients } = useClientsList();
  const { prestations } = usePrestationsList();

  useEffect(() => {
    if (initial) {
      setValues((prev) => ({ ...prev, ...initial }));
    }
    // Un seul sync à l'arrivée d'un initial (Edit preload).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.clientId, initial?.title, initial?.items]);

  useEffect(() => {
    // Recalcule validityDate quand issuedAt ou validityDays change.
    setValues((v) => ({
      ...v,
      validityDate: addDays(v.issuedAt, validityDays),
    }));
  }, [validityDays]);

  const totalHtCents = useMemo(
    () => computeLinesTotal(values.items),
    [values.items],
  );

  async function handleSubmit(issueNumber: boolean): Promise<void> {
    const errs: string[] = [];
    if (!values.clientId) errs.push(fr.quotes.errors.missingClient);
    if (values.title.trim().length === 0)
      errs.push(fr.quotes.errors.missingTitle);
    if (values.items.length === 0) errs.push(fr.quotes.errors.noItems);
    setErrors(errs);
    if (errs.length > 0) return;

    await onSubmit(values, issueNumber);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacing[5],
      }}
    >
      <section
        style={{
          display: "flex",
          flexDirection: "column",
          gap: tokens.spacing[4],
          border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
          padding: tokens.spacing[5],
          background: tokens.color.surface,
          boxShadow: tokens.shadow.sm,
        }}
      >
        <SectionTitle>{fr.quotes.labels.client}</SectionTitle>
        <ClientPicker
          value={values.clientId}
          onChange={(id) =>
            setValues((v) => ({ ...v, clientId: id }))
          }
          clients={clients}
          onQuickCreate={() => setQuickClientModal(true)}
          invalid={errors.includes(fr.quotes.errors.missingClient)}
          disabled={readOnly}
        />

        <SectionTitle>{fr.quotes.labels.title}</SectionTitle>
        <Input
          aria-label={fr.quotes.labels.title}
          placeholder={fr.quotes.form.titlePlaceholder}
          value={values.title}
          onChange={(e) =>
            setValues((v) => ({ ...v, title: e.target.value }))
          }
          invalid={errors.includes(fr.quotes.errors.missingTitle)}
          disabled={readOnly}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: tokens.spacing[4],
          }}
        >
          <Input
            type="date"
            label={fr.quotes.form.issueDate}
            value={new Date(values.issuedAt).toISOString().slice(0, 10)}
            onChange={(e) => {
              const ts = new Date(e.target.value).getTime();
              if (Number.isFinite(ts)) {
                setValues((v) => ({ ...v, issuedAt: ts }));
              }
            }}
            disabled={readOnly}
          />
          <Input
            type="number"
            label={fr.quotes.form.validityDays}
            min={1}
            step={1}
            value={validityDays.toString()}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (Number.isFinite(n) && n >= 1) setValidityDays(n);
            }}
            disabled={readOnly}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: tokens.spacing[1],
            }}
          >
            <span
              style={{
                fontFamily: tokens.font.ui,
                fontWeight: Number(tokens.fontWeight.bold),
                fontSize: tokens.fontSize.xs,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: tokens.color.ink,
              }}
            >
              {fr.quotes.form.validityDateLabel}
            </span>
            <div
              style={{
                padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
                fontFamily: tokens.font.mono,
                fontSize: tokens.fontSize.sm,
                background: tokens.color.paper2,
              }}
              data-testid="validity-date-display"
            >
              {formatFrDate(values.validityDate)}
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          display: "flex",
          flexDirection: "column",
          gap: tokens.spacing[3],
        }}
      >
        <SectionTitle>{fr.quotes.form.description}</SectionTitle>
        <ItemsEditor
          value={values.items}
          onChange={(items) => setValues((v) => ({ ...v, items }))}
          prestations={prestations}
          readOnly={readOnly}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: `${tokens.spacing[4]} ${tokens.spacing[5]}`,
            border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
            background: tokens.color.accentSoft,
            boxShadow: tokens.shadow.sm,
            fontFamily: tokens.font.ui,
            fontWeight: Number(tokens.fontWeight.black),
            textTransform: "uppercase",
            letterSpacing: "-0.01em",
            gap: tokens.spacing[5],
            alignItems: "baseline",
          }}
        >
          <span style={{ fontSize: tokens.fontSize.md }}>
            {fr.quotes.labels.totalHt}
          </span>
          <span
            data-testid="quote-total"
            style={{
              fontFamily: tokens.font.mono,
              fontSize: tokens.fontSize.xl,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatEur(totalHtCents)}
          </span>
        </div>
      </section>

      <section
        style={{
          display: "flex",
          flexDirection: "column",
          gap: tokens.spacing[2],
          border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
          padding: tokens.spacing[5],
          background: tokens.color.surface,
          boxShadow: tokens.shadow.sm,
        }}
      >
        <SectionTitle>{fr.quotes.labels.notes}</SectionTitle>
        <Textarea
          aria-label={fr.quotes.labels.notes}
          placeholder={fr.quotes.form.notesPlaceholder}
          value={values.notes}
          onChange={(e) =>
            setValues((v) => ({ ...v, notes: e.target.value }))
          }
          rows={4}
          disabled={readOnly}
        />
      </section>

      {errors.length > 0 && (
        <div
          role="alert"
          data-testid="form-errors"
          style={{
            border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
            background: tokens.color.dangerBg,
            padding: tokens.spacing[4],
            fontFamily: tokens.font.ui,
            fontWeight: Number(tokens.fontWeight.bold),
            color: tokens.color.ink,
          }}
        >
          <ul style={{ margin: 0, paddingLeft: tokens.spacing[5] }}>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {submitError && (
        <div
          role="alert"
          data-testid="submit-error"
          style={{
            border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
            background: tokens.color.dangerBg,
            padding: tokens.spacing[4],
            fontFamily: tokens.font.ui,
            fontWeight: Number(tokens.fontWeight.bold),
          }}
        >
          {submitError}
        </div>
      )}

      {readOnly !== true && (
        <div
          style={{
            display: "flex",
            gap: tokens.spacing[3],
            justifyContent: "flex-end",
          }}
        >
          <Button variant="ghost" onClick={onCancel} disabled={submitting === true}>
            {fr.quotes.actions.cancel}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void handleSubmit(false)}
            disabled={submitting === true}
            data-testid="save-draft"
          >
            {fr.quotes.actions.saveDraft}
          </Button>
          {editMode !== true && (
            <Button
              variant="primary"
              onClick={() => void handleSubmit(true)}
              disabled={submitting === true}
              data-testid="create-and-issue"
            >
              {fr.quotes.actions.createAndIssue}
            </Button>
          )}
        </div>
      )}

      {quickClientModal && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="quick-client-modal"
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.4)",
            zIndex: 50,
          }}
          onClick={() => setQuickClientModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: tokens.color.surface,
              border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
              boxShadow: tokens.shadow.lg,
              padding: tokens.spacing[6],
              maxWidth: 400,
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: tokens.spacing[4],
            }}
          >
            <SectionTitle>{fr.quotes.form.clientQuickNew}</SectionTitle>
            <p
              style={{
                fontFamily: tokens.font.ui,
                fontSize: tokens.fontSize.sm,
                color: tokens.color.muted,
                margin: 0,
              }}
            >
              {fr.quotes.form.quickClientStub}
            </p>
            <div
              style={{
                display: "flex",
                gap: tokens.spacing[2],
                justifyContent: "flex-end",
              }}
            >
              <Button
                variant="secondary"
                onClick={() => setQuickClientModal(false)}
              >
                {fr.quotes.actions.cancel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }): ReactElement {
  return (
    <h2
      style={{
        font: `${tokens.fontWeight.black} ${tokens.fontSize.md}/1 ${tokens.font.ui}`,
        textTransform: "uppercase",
        letterSpacing: "-0.01em",
        color: tokens.color.ink,
        margin: 0,
      }}
    >
      {children}
    </h2>
  );
}

export function quoteToFormValues(quote: Quote): QuoteFormValues {
  return {
    clientId: quote.clientId,
    title: quote.title,
    issuedAt: quote.issuedAt ?? quote.createdAt,
    validityDate:
      quote.validityDate ??
      addDays(quote.issuedAt ?? quote.createdAt, 30),
    notes: quote.notes ?? "",
    items: quote.items.map((item) => ({
      id: item.id,
      position: item.position,
      description: item.description,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      unit: item.unit,
      lineTotalCents: item.lineTotalCents,
      serviceId: item.serviceId,
    })),
  };
}
