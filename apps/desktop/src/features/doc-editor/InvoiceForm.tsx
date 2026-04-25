import { computeLinesTotal } from "@fakt/core";
import { tokens } from "@fakt/design-tokens";
import { LATE_PAYMENT_PENALTY_RATE, LUMP_SUM_INDEMNITY, TVA_MENTION_MICRO } from "@fakt/legal";
import { addDays, formatEur, formatFrDate, fr, today } from "@fakt/shared";
import type { Invoice, PaymentMethod, UUID } from "@fakt/shared";
import type { Client, Service } from "@fakt/shared";
import { Button, Input, Select, Textarea } from "@fakt/ui";
import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import { ClientPicker } from "./ClientPicker.js";
import { type EditableItem, ItemsEditor } from "./ItemsEditor.js";

export interface InvoiceFormValues {
  clientId: UUID | null;
  title: string;
  issuedAt: number;
  dueDate: number;
  notes: string;
  paymentMethod: PaymentMethod | null;
  items: EditableItem[];
}

export interface InvoiceFormProps {
  initial?: Partial<InvoiceFormValues> | undefined;
  onSubmit: (values: InvoiceFormValues, issueNumber: boolean) => Promise<void>;
  onCancel: () => void;
  submitting?: boolean | undefined;
  submitError?: string | null | undefined;
  /** Mode édition : cache "Créer et émettre". */
  editMode?: boolean | undefined;
  /** Mode détail : tout read-only. */
  readOnly?: boolean | undefined;
  /** Origine du form (pour label et lien). */
  kind?: "scratch" | "from-quote" | undefined;
  /** Si true, le clientId est figé (passé par le devis). */
  clientLocked?: boolean | undefined;
  /** Liste des clients à proposer dans le picker. */
  clients?: ReadonlyArray<Client> | undefined;
  /** Bibliothèque de prestations pour ItemsEditor. */
  prestations?: ReadonlyArray<Service> | undefined;
  /** Note contextualisée (ex: référence au devis lié). */
  contextNote?: string | null | undefined;
}

function initialFromPartial(partial: Partial<InvoiceFormValues> | undefined): InvoiceFormValues {
  const base: InvoiceFormValues = {
    clientId: null,
    title: "",
    issuedAt: today(),
    dueDate: addDays(today(), 30),
    notes: "",
    paymentMethod: "wire",
    items: [],
  };
  return { ...base, ...(partial ?? {}) };
}

const PAYMENT_METHOD_OPTIONS: ReadonlyArray<{ value: PaymentMethod; label: string }> = [
  { value: "wire", label: fr.invoices.form.paymentMethods.wire },
  { value: "check", label: fr.invoices.form.paymentMethods.check },
  { value: "cash", label: fr.invoices.form.paymentMethods.cash },
  { value: "other", label: fr.invoices.form.paymentMethods.other },
];

export function InvoiceForm(props: InvoiceFormProps): ReactElement {
  const {
    initial,
    onSubmit,
    onCancel,
    submitting,
    submitError,
    editMode,
    readOnly,
    clientLocked,
    clients = [],
    prestations = [],
    contextNote,
  } = props;

  const [values, setValues] = useState<InvoiceFormValues>(() => initialFromPartial(initial));
  const [dueDays, setDueDays] = useState<number>(() => {
    const d = initial?.dueDate;
    const i = initial?.issuedAt;
    if (typeof d === "number" && typeof i === "number") {
      return Math.max(1, Math.round((d - i) / 86400000));
    }
    return 30;
  });
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (initial) {
      setValues((prev) => ({ ...prev, ...initial }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.clientId, initial?.title, initial?.items]);

  useEffect(() => {
    setValues((v) => ({ ...v, dueDate: addDays(v.issuedAt, dueDays) }));
  }, [dueDays]);

  const totalHtCents = useMemo(() => computeLinesTotal(values.items), [values.items]);

  async function handleSubmit(issueNumber: boolean): Promise<void> {
    const errs: string[] = [];
    if (!values.clientId) errs.push(fr.invoices.errors.missingClient);
    if (values.title.trim().length === 0) errs.push(fr.invoices.errors.missingTitle);
    if (values.items.length === 0) errs.push(fr.invoices.errors.noItems);
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
      {contextNote && (
        <div
          data-testid="invoice-context-note"
          style={{
            border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
            background: tokens.color.accentSoft,
            padding: tokens.spacing[3],
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.sm,
            fontWeight: Number(tokens.fontWeight.bold),
          }}
        >
          {contextNote}
        </div>
      )}

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
        <SectionTitle>{fr.invoices.labels.client}</SectionTitle>
        <ClientPicker
          value={values.clientId}
          onChange={(id) => setValues((v) => ({ ...v, clientId: id }))}
          clients={clients}
          invalid={errors.includes(fr.invoices.errors.missingClient)}
          disabled={readOnly || clientLocked}
        />

        <SectionTitle>{fr.invoices.labels.title}</SectionTitle>
        <Input
          aria-label={fr.invoices.labels.title}
          placeholder={fr.invoices.form.titlePlaceholder}
          value={values.title}
          onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
          invalid={errors.includes(fr.invoices.errors.missingTitle)}
          disabled={readOnly}
          data-testid="invoice-form-title"
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
            label={fr.invoices.form.issueDate}
            value={new Date(values.issuedAt).toISOString().slice(0, 10)}
            onChange={(e) => {
              const ts = new Date(e.target.value).getTime();
              if (Number.isFinite(ts)) {
                setValues((v) => ({ ...v, issuedAt: ts }));
              }
            }}
            disabled={readOnly}
            data-testid="invoice-form-issued-at"
          />
          <Input
            type="number"
            label={fr.invoices.form.dueDays}
            min={1}
            step={1}
            value={dueDays.toString()}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (Number.isFinite(n) && n >= 1) setDueDays(n);
            }}
            disabled={readOnly}
            data-testid="invoice-form-due-days"
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
              {fr.invoices.form.dueDateLabel}
            </span>
            <div
              style={{
                padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
                fontFamily: tokens.font.mono,
                fontSize: tokens.fontSize.sm,
                background: tokens.color.paper2,
              }}
              data-testid="due-date-display"
            >
              {formatFrDate(values.dueDate)}
            </div>
          </div>
        </div>

        <SectionTitle>{fr.invoices.labels.paymentMethod}</SectionTitle>
        <Select
          aria-label={fr.invoices.labels.paymentMethod}
          options={PAYMENT_METHOD_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
          value={values.paymentMethod ?? "wire"}
          onChange={(e) =>
            setValues((v) => ({
              ...v,
              paymentMethod: e.target.value as PaymentMethod,
            }))
          }
          disabled={readOnly}
          data-testid="invoice-form-payment-method"
        />
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
          <span style={{ fontSize: tokens.fontSize.md }}>{fr.invoices.labels.totalHt}</span>
          <span
            data-testid="invoice-total"
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
        <SectionTitle>{fr.invoices.labels.notes}</SectionTitle>
        <Textarea
          aria-label={fr.invoices.labels.notes}
          placeholder={fr.invoices.form.notesPlaceholder}
          value={values.notes}
          onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
          rows={3}
          disabled={readOnly}
          data-testid="invoice-form-notes"
        />
      </section>

      <section
        data-testid="legal-mentions-section"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: tokens.spacing[2],
          border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
          padding: tokens.spacing[5],
          background: tokens.color.paper2,
          boxShadow: tokens.shadow.sm,
        }}
      >
        <SectionTitle>{fr.invoices.form.legalMentionsTitle}</SectionTitle>
        <p
          style={{
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.xs,
            color: tokens.color.muted,
            margin: 0,
          }}
        >
          {fr.invoices.form.legalMentionsHint}
        </p>
        <ul
          style={{
            margin: 0,
            paddingLeft: tokens.spacing[5],
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.sm,
            color: tokens.color.ink,
            display: "flex",
            flexDirection: "column",
            gap: tokens.spacing[1],
          }}
        >
          <li data-testid="mention-tva">{TVA_MENTION_MICRO}</li>
          <li data-testid="mention-penalty">{LATE_PAYMENT_PENALTY_RATE}</li>
          <li data-testid="mention-lumpsum">{LUMP_SUM_INDEMNITY}</li>
        </ul>
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
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={submitting === true}
            data-testid="invoice-form-cancel"
          >
            {fr.invoices.actions.cancel}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void handleSubmit(false)}
            disabled={submitting === true}
            data-testid="invoice-save-draft"
          >
            {fr.invoices.actions.saveDraft}
          </Button>
          {editMode !== true && (
            <Button
              variant="primary"
              onClick={() => void handleSubmit(true)}
              disabled={submitting === true}
              data-testid="invoice-create-and-issue"
            >
              {fr.invoices.actions.createAndIssue}
            </Button>
          )}
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

export function invoiceToFormValues(invoice: Invoice): InvoiceFormValues {
  return {
    clientId: invoice.clientId,
    title: invoice.title,
    issuedAt: invoice.issuedAt ?? invoice.createdAt,
    dueDate: invoice.dueDate ?? addDays(invoice.issuedAt ?? invoice.createdAt, 30),
    notes: "",
    paymentMethod: invoice.paymentMethod ?? "wire",
    items: invoice.items.map((item) => ({
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
