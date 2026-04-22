import type { ReactElement } from "react";
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button, Modal, Input, Textarea, Select, toast } from "@fakt/ui";
import type { SelectOption } from "@fakt/ui";
import { tokens } from "@fakt/design-tokens";
import { fr } from "@fakt/shared";
import type { Quote, Invoice } from "@fakt/shared";
import type { EmailTemplateKey } from "@fakt/email";
import { renderTemplate, buildEml, buildMailtoUrl } from "@fakt/email";
import { pdfApi } from "../../features/doc-editor/pdf-api.js";
import type { RenderQuoteArgs, RenderInvoiceArgs } from "../../features/doc-editor/pdf-api.js";
import { api } from "../../api/index.js";

type DocType = "quote" | "invoice";

interface PrepareEmailModalQuoteProps {
  docType: "quote";
  doc: Quote;
  clientName: string;
  clientEmail: string | null;
  workspaceName: string;
  workspaceEmail: string;
  renderArgs: RenderQuoteArgs;
}

interface PrepareEmailModalInvoiceProps {
  docType: "invoice";
  doc: Invoice;
  clientName: string;
  clientEmail: string | null;
  workspaceName: string;
  workspaceEmail: string;
  renderArgs: RenderInvoiceArgs;
}

export type PrepareEmailModalProps = (
  | PrepareEmailModalQuoteProps
  | PrepareEmailModalInvoiceProps
) & {
  open: boolean;
  onClose: () => void;
};

const TEMPLATE_OPTIONS: SelectOption[] = [
  { value: "quote_sent", label: fr.email.templates.quote_sent },
  { value: "invoice_sent", label: fr.email.templates.invoice_sent },
  { value: "reminder", label: fr.email.templates.reminder },
  { value: "thanks", label: fr.email.templates.thanks },
];

function defaultTemplate(
  docType: DocType,
  status: string,
): EmailTemplateKey {
  if (docType === "quote") return "quote_sent";
  if (status === "overdue") return "reminder";
  if (status === "paid") return "thanks";
  return "invoice_sent";
}

function formatAmount(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatDateFr(ts: number | null | undefined): string | undefined {
  if (!ts) return undefined;
  return new Date(ts).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function PrepareEmailModal(props: PrepareEmailModalProps): ReactElement {
  const { open, onClose, docType, clientName, clientEmail, workspaceName, workspaceEmail } = props;
  const doc = props.doc as Quote & Invoice;

  const [templateKey, setTemplateKey] = useState<EmailTemplateKey>(
    () => defaultTemplate(docType, doc.status),
  );
  const [toEmail, setToEmail] = useState(clientEmail ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [useMailto, setUseMailto] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const dueDate = "dueDate" in doc ? formatDateFr(doc.dueDate) : undefined;
  const ctx = {
    client_name: clientName,
    doc_num: doc.number ?? "—",
    amount_ttc_eur: formatAmount(doc.totalHtCents),
    due_date_fr: dueDate,
    workspace_name: workspaceName,
  };

  useEffect(() => {
    if (!open) return;
    const rendered = renderTemplate(templateKey, ctx);
    setSubject(rendered.subject);
    setBody(rendered.bodyPlain);
  }, [templateKey, open]);

  useEffect(() => {
    if (!open) return;
    setTemplateKey(defaultTemplate(docType, doc.status));
    setToEmail(clientEmail ?? "");
    setSubmitError(null);
    setUseMailto(false);
  }, [open]);

  async function handleOpenDraft(): Promise<void> {
    if (!toEmail.trim()) {
      setSubmitError(fr.email.errors.toRequired);
      return;
    }
    if (!subject.trim()) {
      setSubmitError(fr.email.errors.subjectRequired);
      return;
    }
    if (!body.trim()) {
      setSubmitError(fr.email.errors.bodyRequired);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      if (useMailto) {
        const url = buildMailtoUrl({ to: toEmail, subject, body });
        await invoke("open_mailto_fallback", { url });
        toast.success(fr.email.success.mailtoOpened);
        onClose();
        return;
      }

      let pdfBytes: Uint8Array;
      try {
        if (docType === "quote") {
          pdfBytes = await pdfApi.renderQuote((props as PrepareEmailModalQuoteProps).renderArgs);
        } else {
          pdfBytes = await pdfApi.renderInvoice((props as PrepareEmailModalInvoiceProps).renderArgs);
        }
      } catch {
        throw new Error(fr.email.errors.pdfFailed);
      }

      const b64 = btoa(
        Array.from(pdfBytes)
          .map((b) => String.fromCharCode(b))
          .join(""),
      );
      const filename = `${doc.number ?? "document"}.pdf`;

      const rendered = renderTemplate(templateKey, ctx);
      const emlContent = buildEml({
        from: workspaceEmail,
        to: toEmail,
        subject,
        bodyPlain: body,
        bodyHtml: rendered.bodyHtml,
        attachments: [{ filename, contentType: "application/pdf", contentBase64: b64 }],
      });

      const emlPath = await saveEmlTemp(emlContent, doc.number ?? "draft");
      let fellBackToMailto = false;
      await invoke("open_email_draft", { emlPath }).catch(async () => {
        fellBackToMailto = true;
        const url = buildMailtoUrl({ to: toEmail, subject, body });
        await invoke("open_mailto_fallback", { url });
        toast.success(fr.email.success.fallbackUsed);
      });

      // Log l'évent dans l'activity feed — best-effort, ne doit pas bloquer l'UX.
      api.activity
        .append({
          type: "email_drafted",
          entityType: docType,
          entityId: doc.id,
          payload: JSON.stringify({
            template: templateKey,
            to: toEmail,
            fallback: fellBackToMailto ? "mailto" : null,
          }),
        })
        .catch(() => {});

      toast.success(fr.email.success.draftOpened);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : fr.errors.generic);
    } finally {
      setSubmitting(false);
    }
  }

  const docLabel = doc.number
    ? `${doc.number} — ${clientName}`
    : `${docType === "quote" ? "Devis" : "Facture"} — ${clientName}`;

  return (
    <Modal
      open={open}
      title={`${fr.email.modal.title} — ${docLabel}`}
      onClose={() => {
        if (!submitting) onClose();
      }}
      size="lg"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
            data-testid="email-modal-cancel"
          >
            {fr.email.actions.cancel}
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleOpenDraft()}
            disabled={submitting}
            data-testid="email-modal-submit"
          >
            {submitting ? fr.email.actions.generating : fr.email.actions.openInMail}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing[4] }}>
        {!clientEmail && (
          <div
            role="alert"
            style={{
              border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
              background: tokens.color.accentSoft,
              padding: tokens.spacing[3],
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.sm,
              fontWeight: Number(tokens.fontWeight.bold),
            }}
          >
            {fr.email.warnings.noClientEmail}
          </div>
        )}

        <Select
          label={fr.email.fields.template}
          options={TEMPLATE_OPTIONS}
          value={templateKey}
          onChange={(e) => setTemplateKey(e.target.value as EmailTemplateKey)}
          data-testid="email-modal-template"
        />

        <Input
          label={fr.email.fields.to}
          type="email"
          value={toEmail}
          onChange={(e) => setToEmail(e.target.value)}
          placeholder="client@example.com"
          invalid={!toEmail.trim() && submitError !== null}
          data-testid="email-modal-to"
        />

        <Input
          label={fr.email.fields.subject}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          invalid={!subject.trim() && submitError !== null}
          data-testid="email-modal-subject"
        />

        <Textarea
          label={fr.email.fields.body}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          invalid={!body.trim() && submitError !== null}
          data-testid="email-modal-body"
        />

        <div
          style={{
            border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
            padding: tokens.spacing[3],
            display: "flex",
            alignItems: "center",
            gap: tokens.spacing[3],
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.sm,
          }}
        >
          <span style={{ fontWeight: Number(tokens.fontWeight.bold), textTransform: "uppercase", letterSpacing: "0.06em", fontSize: tokens.fontSize.xs, color: tokens.color.muted }}>
            {fr.email.fields.attachment}
          </span>
          <span>{doc.number ?? fr.quotes.labels.numberPending}.pdf</span>
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: tokens.spacing[2],
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.sm,
            color: tokens.color.ink,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={useMailto}
            onChange={(e) => setUseMailto(e.target.checked)}
            data-testid="email-modal-mailto-toggle"
            style={{ width: 14, height: 14 }}
          />
          {fr.email.fields.useMailto}
        </label>

        {submitError && (
          <div
            role="alert"
            data-testid="email-modal-error"
            style={{
              border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
              background: tokens.color.dangerBg,
              padding: tokens.spacing[3],
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.sm,
              fontWeight: Number(tokens.fontWeight.bold),
            }}
          >
            {submitError}
          </div>
        )}
      </div>
    </Modal>
  );
}

async function saveEmlTemp(content: string, docNumber: string): Promise<string> {
  const filename = `${docNumber}-${Date.now()}.eml`;
  const tmpPath = await invoke<string>("plugin:path|temp_dir").catch(
    () => "/tmp",
  );
  const fullPath = `${tmpPath}/fakt-drafts/${filename}`;

  await invoke("plugin:fs|create_dir", {
    path: `${tmpPath}/fakt-drafts`,
    options: { recursive: true },
  }).catch(() => {});

  await invoke("plugin:fs|write_text_file", {
    path: fullPath,
    contents: content,
  });

  return fullPath;
}
