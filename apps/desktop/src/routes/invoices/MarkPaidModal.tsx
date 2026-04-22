import { tokens } from "@fakt/design-tokens";
import { fr, startOfDay, today } from "@fakt/shared";
import type { PaymentMethod, TimestampMs } from "@fakt/shared";
import { Button, Modal } from "@fakt/ui";
import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import { z } from "zod";

/** Méthode sélectionnable dans l'UI, inclut "card" même si le backend persiste "other". */
export type MarkPaidMethodChoice = "wire" | "card" | "cash" | "check" | "other";

export interface MarkPaidPayload {
  paidAt: TimestampMs;
  method: PaymentMethod;
  notes: string | null;
}

export interface MarkPaidModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: MarkPaidPayload) => Promise<void>;
  submitting?: boolean;
  error?: string | null;
}

function toIso(ts: TimestampMs): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromIso(iso: string): TimestampMs | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map((n) => Number(n));
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return startOfDay(date.getTime());
}

/** Mappe la méthode UI sur la méthode persistée côté DB. */
function toPersistedMethod(choice: MarkPaidMethodChoice): PaymentMethod {
  if (choice === "wire") return "wire";
  if (choice === "check") return "check";
  if (choice === "cash") return "cash";
  return "other";
}

const formSchema = z
  .object({
    dateIso: z.string().min(1, fr.payment.errors.dateRequired),
    method: z.enum(["wire", "card", "cash", "check", "other"]),
    customMethod: z.string().optional(),
    notes: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    const ts = fromIso(val.dateIso);
    if (ts === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateIso"],
        message: fr.payment.errors.dateRequired,
      });
      return;
    }
    if (ts > today()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateIso"],
        message: fr.payment.errors.dateFuture,
      });
    }
    if (val.method === "other") {
      const trimmed = (val.customMethod ?? "").trim();
      if (trimmed.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["customMethod"],
          message: fr.payment.errors.customMethodRequired,
        });
      }
    }
  });

const METHOD_OPTIONS: ReadonlyArray<{ value: MarkPaidMethodChoice; label: string }> = [
  { value: "wire", label: fr.payment.methods.wire },
  { value: "card", label: fr.payment.methods.card },
  { value: "cash", label: fr.payment.methods.cash },
  { value: "check", label: fr.payment.methods.check },
  { value: "other", label: fr.payment.methods.other },
];

export function MarkPaidModal({
  open,
  onClose,
  onConfirm,
  submitting = false,
  error = null,
}: MarkPaidModalProps): ReactElement {
  const [dateIso, setDateIso] = useState<string>(() => toIso(today()));
  const [method, setMethod] = useState<MarkPaidMethodChoice>("wire");
  const [customMethod, setCustomMethod] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const canSubmit = useMemo(() => !submitting && dateIso.length > 0, [submitting, dateIso]);

  async function handleConfirm(): Promise<void> {
    const parsed = formSchema.safeParse({
      dateIso,
      method,
      customMethod,
      notes,
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    const ts = fromIso(parsed.data.dateIso);
    if (ts === null) return;
    const trimmedCustom = parsed.data.customMethod?.trim() ?? "";
    const notesValue = parsed.data.notes?.trim() ?? "";
    const composedNotes =
      parsed.data.method === "other" && trimmedCustom.length > 0
        ? notesValue.length > 0
          ? `${trimmedCustom} — ${notesValue}`
          : trimmedCustom
        : notesValue;

    await onConfirm({
      paidAt: ts,
      method: toPersistedMethod(parsed.data.method),
      notes: composedNotes.length > 0 ? composedNotes : null,
    });
  }

  return (
    <Modal
      open={open}
      title={fr.payment.modal.title}
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
            data-testid="mark-paid-cancel"
          >
            {fr.payment.modal.cancel}
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleConfirm()}
            disabled={!canSubmit}
            data-testid="mark-paid-confirm"
          >
            {fr.payment.modal.confirm}
          </Button>
        </>
      }
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: tokens.spacing[4],
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.sm,
            color: tokens.color.muted,
          }}
        >
          {fr.payment.modal.subtitle}
        </p>

        <Field
          label={fr.payment.modal.dateLabel}
          error={fieldErrors.dateIso}
          htmlFor="mark-paid-date"
        >
          <input
            id="mark-paid-date"
            type="date"
            className="fakt-input"
            value={dateIso}
            onChange={(e) => setDateIso(e.target.value)}
            max={toIso(today())}
            data-testid="mark-paid-date"
          />
        </Field>

        <Field
          label={fr.payment.modal.methodLabel}
          error={fieldErrors.method}
          htmlFor="mark-paid-method"
        >
          <select
            id="mark-paid-method"
            className="fakt-input"
            value={method}
            onChange={(e) => setMethod(e.target.value as MarkPaidMethodChoice)}
            data-testid="mark-paid-method"
          >
            {METHOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>

        {method === "other" && (
          <Field
            label={fr.payment.modal.customMethodLabel}
            error={fieldErrors.customMethod}
            htmlFor="mark-paid-custom"
          >
            <input
              id="mark-paid-custom"
              type="text"
              className="fakt-input"
              value={customMethod}
              onChange={(e) => setCustomMethod(e.target.value)}
              placeholder={fr.payment.modal.customMethodPlaceholder}
              data-testid="mark-paid-custom"
            />
          </Field>
        )}

        <Field
          label={fr.payment.modal.notesLabel}
          error={fieldErrors.notes}
          htmlFor="mark-paid-notes"
        >
          <textarea
            id="mark-paid-notes"
            className="fakt-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={fr.payment.modal.notesPlaceholder}
            rows={3}
            style={{ resize: "vertical", minHeight: 72 }}
            data-testid="mark-paid-notes"
          />
        </Field>

        {error && (
          <div
            role="alert"
            data-testid="mark-paid-error"
            style={{
              border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
              background: tokens.color.dangerBg,
              padding: tokens.spacing[3],
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.sm,
              fontWeight: Number(tokens.fontWeight.bold),
            }}
          >
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}

interface FieldProps {
  label: string;
  error: string | undefined;
  htmlFor: string;
  children: ReactElement;
}

function Field({ label, error, htmlFor, children }: FieldProps): ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing[1] }}>
      <label
        htmlFor={htmlFor}
        style={{
          fontFamily: tokens.font.ui,
          fontSize: tokens.fontSize.xs,
          fontWeight: Number(tokens.fontWeight.bold),
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: tokens.color.ink,
        }}
      >
        {label}
      </label>
      {children}
      {error && (
        <span
          role="alert"
          style={{
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.xs,
            color: tokens.color.ink,
            background: tokens.color.dangerBg,
            padding: "2px 6px",
            border: `${tokens.stroke.hair} solid ${tokens.color.ink}`,
            alignSelf: "flex-start",
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
