import { tokens } from "@fakt/design-tokens";
import { TVA_MENTION_MICRO } from "@fakt/legal";
import { formatEur, formatFrDate, formatFrDateLong, fr, today } from "@fakt/shared";
import type { Client, Invoice } from "@fakt/shared";
import { Button, Modal, StatusPill, toast } from "@fakt/ui";
import type { StatusKind } from "@fakt/ui";
import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { DesktopOnlyButton } from "../../components/DesktopOnlyButton.js";
import { AuditTimeline, type BaseAuditEntry } from "../../components/audit-timeline/index.js";
import { invalidateSearchIndex } from "../../components/command-palette/useCommandPaletteIndex.js";
import { PrepareEmailModal } from "../../components/prepare-email-modal/index.js";
import { SignatureModal } from "../../components/signature-modal/index.js";
import { clientsApi } from "../../features/doc-editor/clients-api.js";
import { invoiceApi } from "../../features/doc-editor/invoice-api.js";
import { pdfApi } from "../../features/doc-editor/pdf-api.js";
import { useClientsList, useWorkspace } from "../quotes/hooks.js";
import { MarkPaidModal, type MarkPaidPayload } from "./MarkPaidModal.js";
import { useInvoice } from "./hooks.js";

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toInvoiceInput(inv: Invoice): Parameters<typeof pdfApi.renderInvoice>[0]["invoice"] {
  return {
    id: inv.id,
    workspaceId: inv.workspaceId,
    clientId: inv.clientId,
    quoteId: inv.quoteId,
    number: inv.number,
    year: inv.year,
    sequence: inv.sequence,
    kind: inv.kind,
    depositPercent: inv.depositPercent,
    title: inv.title,
    status: inv.status,
    totalHtCents: inv.totalHtCents,
    dueDate: inv.dueDate,
    paidAt: inv.paidAt,
    paymentMethod: inv.paymentMethod,
    legalMentions: inv.legalMentions,
    issuedAt: inv.issuedAt,
    archivedAt: inv.archivedAt,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
    items: inv.items,
  };
}

export function InvoiceDetailRoute(): ReactElement {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const id = params.id;
  const { invoice, loading, error, refresh } = useInvoice(id);
  const { workspace } = useWorkspace();
  const { clients } = useClientsList();
  const [client, setClient] = useState<Client | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [markSentOpen, setMarkSentOpen] = useState(false);
  const [markSentSubmitting, setMarkSentSubmitting] = useState(false);
  const [markSentError, setMarkSentError] = useState<string | null>(null);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [markPaidSubmitting, setMarkPaidSubmitting] = useState(false);
  const [markPaidError, setMarkPaidError] = useState<string | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);

  useEffect(() => {
    if (!invoice) return;
    const inList = clients.find((c) => c.id === invoice.clientId);
    if (inList) {
      setClient(inList);
      return;
    }
    let cancelled = false;
    clientsApi
      .get(invoice.clientId)
      .then((c) => {
        if (!cancelled) setClient(c);
      })
      .catch(() => {
        if (!cancelled) setClient(null);
      });
    return (): void => {
      cancelled = true;
    };
  }, [invoice, clients]);

  useEffect(() => {
    if (!invoice || !client || !workspace) return;
    if (!invoice.number || !invoice.issuedAt) {
      setPdfUrl(null);
      return;
    }

    let cancelled = false;
    let revoke: string | null = null;
    setPdfError(null);

    pdfApi
      .renderInvoice({
        invoice: toInvoiceInput(invoice),
        client,
        workspace,
      })
      .then((bytes) => {
        if (cancelled) return;
        setPdfBytes(bytes);
        const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        revoke = url;
        setPdfUrl(url);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setPdfError(err instanceof Error ? err.message : fr.invoices.errors.pdfFailed);
        }
      });

    return (): void => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [invoice, client, workspace]);

  async function handleDownload(): Promise<void> {
    if (!invoice || !client || !workspace) return;
    try {
      const bytes = await pdfApi.renderInvoice({
        invoice: toInvoiceInput(invoice),
        client,
        workspace,
      });
      const filename = `Facture-${invoice.number ?? "draft"}-${slugify(client.name)}.pdf`;
      const path = await pdfApi.saveDialog(filename);
      if (!path) return; // user annule dialog, pas d'erreur
      try {
        await pdfApi.writeFile(path, bytes);
        toast.success(fr.invoices.detail.pdfSaved);
      } catch (err) {
        const msg = err instanceof Error ? err.message : fr.invoices.detail.pdfSaveFailed;
        setPdfError(msg);
        toast.error(`${fr.invoices.detail.pdfSaveFailed} — ${msg}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : fr.invoices.errors.pdfFailed;
      setPdfError(msg);
      toast.error(msg);
    }
  }

  async function handleMarkSent(): Promise<void> {
    if (!invoice) return;
    // Guard synchrone double-submit : un double-clic sur "Émettre" allouait
    // 2 numéros F-séquentiels (CGI art. 289) pour une seule facture côté UI.
    if (markSentSubmitting) return;
    setMarkSentSubmitting(true);
    setMarkSentError(null);
    try {
      await invoiceApi.updateStatus(invoice.id, "sent");
      setMarkSentOpen(false);
      toast.success(fr.invoices.detail.markSentSuccess);
      refresh();
    } catch (err) {
      setMarkSentError(err instanceof Error ? err.message : fr.invoices.detail.markSentError);
    } finally {
      setMarkSentSubmitting(false);
    }
  }

  async function handleMarkPaid(payload: MarkPaidPayload): Promise<void> {
    if (!invoice) return;
    // Guard synchrone double-submit.
    if (markPaidSubmitting) return;
    setMarkPaidSubmitting(true);
    setMarkPaidError(null);
    try {
      await invoiceApi.markPaid(invoice.id, {
        paidAt: payload.paidAt,
        method: payload.method,
        notes: payload.notes,
      });
      setMarkPaidOpen(false);
      toast.success(fr.payment.modal.success);
      refresh();
    } catch (err) {
      setMarkPaidError(err instanceof Error ? err.message : fr.payment.modal.error);
    } finally {
      setMarkPaidSubmitting(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!invoice) return;
    if (invoice.status !== "draft") {
      setDeleteError(fr.invoices.errors.deleteIssued);
      return;
    }
    setDeleteError(null);
    try {
      await invoiceApi.delete(invoice.id);
      invalidateSearchIndex();
      void navigate("/invoices");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : fr.invoices.errors.deleteIssued);
    }
  }

  const isDraft = invoice?.status === "draft";
  const isSent = invoice?.status === "sent";
  const isOverdue = useMemo((): boolean => {
    if (!invoice) return false;
    if (invoice.status !== "sent") return false;
    if (!invoice.dueDate) return false;
    return invoice.dueDate < today();
  }, [invoice]);
  const displayStatus: StatusKind = isOverdue
    ? "overdue"
    : ((invoice?.status ?? "draft") as StatusKind);

  const metadata = useMemo(() => {
    if (!invoice) return [];
    const rows: Array<[string, string]> = [
      [fr.invoices.labels.number, invoice.number ?? fr.invoices.labels.numberPending],
      [fr.invoices.labels.client, client?.name ?? "—"],
      [fr.invoices.labels.kind, fr.invoices.kind[invoice.kind]],
      [fr.invoices.labels.totalHt, formatEur(invoice.totalHtCents)],
      [fr.invoices.labels.issuedAt, invoice.issuedAt ? formatFrDateLong(invoice.issuedAt) : "—"],
      [fr.invoices.labels.dueDate, invoice.dueDate ? formatFrDateLong(invoice.dueDate) : "—"],
      [fr.invoices.labels.createdAt, formatFrDate(invoice.createdAt)],
    ];
    if (invoice.paidAt) {
      rows.push([fr.invoices.labels.paidAt, formatFrDateLong(invoice.paidAt)]);
    }
    if (invoice.quoteId) {
      rows.push([fr.invoices.labels.quoteLink, invoice.quoteId.slice(0, 8)]);
    }
    return rows;
  }, [invoice, client]);

  if (loading) {
    return <div style={{ padding: tokens.spacing[6] }}>Chargement…</div>;
  }

  if (error || !invoice) {
    return (
      <div style={{ padding: tokens.spacing[6] }} data-testid="invoice-detail-not-found">
        {fr.invoices.errors.notFound}
      </div>
    );
  }

  return (
    <div
      style={{
        padding: tokens.spacing[6],
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacing[5],
        height: "calc(100vh - 56px)",
        boxSizing: "border-box",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: tokens.spacing[4],
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              gap: tokens.spacing[3],
              alignItems: "center",
            }}
          >
            <h1
              style={{
                font: `var(--w-black) var(--t-2xl)/1 ${tokens.font.ui}`,
                letterSpacing: "-0.02em",
                textTransform: "uppercase",
                color: tokens.color.ink,
                margin: 0,
              }}
            >
              {invoice.number ?? fr.invoices.labels.numberPending}
            </h1>
            <StatusPill status={displayStatus} />
          </div>
          <p
            style={{
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.md,
              color: tokens.color.ink,
              marginTop: tokens.spacing[2],
              marginBottom: 0,
            }}
          >
            {invoice.title}
          </p>
        </div>
        <div style={{ display: "flex", gap: tokens.spacing[2] }}>
          <Button variant="ghost" onClick={() => void navigate("/invoices")}>
            {fr.invoices.actions.backToList}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void navigate(`/invoices/${invoice.id}/edit`)}
            disabled={!isDraft}
            data-testid="invoice-detail-edit"
          >
            {fr.invoices.actions.edit}
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleDownload()}
            disabled={!invoice.number}
            data-testid="invoice-detail-download"
          >
            {fr.invoices.actions.downloadPdf}
          </Button>
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.6fr 1fr",
          gap: tokens.spacing[5],
          flex: 1,
          minHeight: 0,
        }}
      >
        <section
          aria-label={fr.invoices.detail.previewTitle}
          style={{
            border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
            background: tokens.color.paper2,
            boxShadow: tokens.shadow.sm,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <div
            style={{
              padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
              borderBottom: `${tokens.stroke.base} solid ${tokens.color.ink}`,
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.xs,
              fontWeight: Number(tokens.fontWeight.bold),
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              background: tokens.color.surface,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>{fr.invoices.detail.previewTitle}</span>
            {pdfUrl && (
              <div style={{ display: "flex", gap: tokens.spacing[2] }}>
                <InvPdfToolbarButton
                  label="Zoom +"
                  onClick={() => {
                    const iframe = document.querySelector<HTMLIFrameElement>(
                      "[data-testid='invoice-pdf-iframe']"
                    );
                    if (iframe?.contentWindow)
                      iframe.contentWindow.document.body.style.zoom = "1.2";
                  }}
                />
                <InvPdfToolbarButton
                  label="Zoom -"
                  onClick={() => {
                    const iframe = document.querySelector<HTMLIFrameElement>(
                      "[data-testid='invoice-pdf-iframe']"
                    );
                    if (iframe?.contentWindow)
                      iframe.contentWindow.document.body.style.zoom = "0.8";
                  }}
                />
                <InvPdfToolbarButton
                  label="Plein écran"
                  onClick={() => {
                    if (pdfUrl) window.open(pdfUrl, "_blank");
                  }}
                />
              </div>
            )}
          </div>
          <div style={{ flex: 1, position: "relative", minHeight: 400 }}>
            {pdfUrl ? (
              <iframe
                title={fr.invoices.detail.previewTitle}
                src={pdfUrl}
                data-testid="invoice-pdf-iframe"
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  background: tokens.color.surface,
                }}
              />
            ) : (
              <div
                style={{
                  padding: tokens.spacing[6],
                  textAlign: "center",
                  fontFamily: tokens.font.ui,
                  fontSize: tokens.fontSize.sm,
                  color: tokens.color.muted,
                }}
                data-testid="invoice-pdf-placeholder"
              >
                {pdfError ?? (isDraft ? fr.invoices.detail.noPdfDraft : fr.invoices.detail.noPdf)}
              </div>
            )}
          </div>
        </section>

        <aside
          aria-label={fr.invoices.detail.infosTitle}
          style={{
            border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
            background: tokens.color.surface,
            boxShadow: tokens.shadow.sm,
            padding: tokens.spacing[5],
            display: "flex",
            flexDirection: "column",
            gap: tokens.spacing[4],
            overflow: "auto",
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
            {fr.invoices.detail.infosTitle}
          </h2>

          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
              margin: 0,
            }}
          >
            {metadata.map(([k, v]) => (
              <DescriptionRow key={k} label={k} value={v} />
            ))}
          </dl>

          <div
            style={{
              borderTop: `${tokens.stroke.base} solid ${tokens.color.ink}`,
              paddingTop: tokens.spacing[3],
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.xs,
              color: tokens.color.muted,
            }}
          >
            {TVA_MENTION_MICRO}
          </div>

          <div
            style={{
              display: "flex",
              gap: tokens.spacing[2],
              flexDirection: "column",
              borderTop: `${tokens.stroke.base} solid ${tokens.color.ink}`,
              paddingTop: tokens.spacing[3],
            }}
          >
            {isDraft && (
              <Button
                variant="primary"
                onClick={() => setMarkSentOpen(true)}
                disabled={!invoice.number}
                data-testid="invoice-detail-mark-sent"
              >
                {fr.invoices.actions.markSent}
              </Button>
            )}
            {(isSent || isOverdue) && (
              <Button
                variant="primary"
                onClick={() => setMarkPaidOpen(true)}
                data-testid="invoice-detail-mark-paid"
              >
                {fr.invoices.actions.markPaid}
              </Button>
            )}
            {!isDraft && (
              <Button
                variant="secondary"
                onClick={() => setEmailOpen(true)}
                disabled={!invoice.number}
                data-testid="invoice-detail-prepare-email"
              >
                {fr.email.actions.openInMail}
              </Button>
            )}
            {(isDraft || isSent) && (
              <DesktopOnlyButton
                variant="secondary"
                onClick={() => setSignOpen(true)}
                disabled={!invoice.number || !pdfBytes || pdfBytes.byteLength === 0}
                data-testid="invoice-detail-sign"
              >
                {fr.quotes.actions.sign}
              </DesktopOnlyButton>
            )}
            {isDraft && (
              <Button
                variant="ghost"
                onClick={() => void handleDelete()}
                data-testid="invoice-detail-delete"
              >
                {fr.invoices.actions.delete}
              </Button>
            )}
          </div>

          {deleteError && (
            <div
              role="alert"
              data-testid="invoice-delete-error"
              style={{
                border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
                background: tokens.color.dangerBg,
                padding: tokens.spacing[3],
                fontFamily: tokens.font.ui,
                fontSize: tokens.fontSize.sm,
                fontWeight: Number(tokens.fontWeight.bold),
              }}
            >
              {fr.invoices.detail.archivalLegalNotice}
            </div>
          )}

          <div
            style={{
              borderTop: `${tokens.stroke.base} solid ${tokens.color.ink}`,
              paddingTop: tokens.spacing[3],
            }}
          >
            <div
              style={{
                fontFamily: tokens.font.ui,
                fontSize: tokens.fontSize.xs,
                fontWeight: Number(tokens.fontWeight.bold),
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: tokens.color.muted,
                marginBottom: tokens.spacing[2],
              }}
            >
              {fr.audit.title}
            </div>
            <AuditTimeline
              docType="invoice"
              docId={invoice.id}
              extraEntries={buildInvoiceExtras(invoice)}
            />
          </div>
        </aside>
      </div>

      <Modal
        open={markSentOpen}
        title={fr.invoices.detail.markSentTitle}
        onClose={() => {
          if (!markSentSubmitting) {
            setMarkSentOpen(false);
            setMarkSentError(null);
          }
        }}
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setMarkSentOpen(false);
                setMarkSentError(null);
              }}
              disabled={markSentSubmitting}
              data-testid="invoice-detail-mark-sent-cancel"
            >
              {fr.invoices.actions.cancel}
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleMarkSent()}
              disabled={markSentSubmitting}
              data-testid="invoice-detail-mark-sent-confirm"
            >
              {fr.invoices.actions.confirm}
            </Button>
          </>
        }
      >
        <p
          style={{
            margin: 0,
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.sm,
            color: tokens.color.ink,
            lineHeight: 1.5,
          }}
        >
          {fr.invoices.detail.markSentBody}
        </p>
        {markSentError && (
          <div
            role="alert"
            data-testid="invoice-detail-mark-sent-error"
            style={{
              marginTop: tokens.spacing[3],
              border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
              background: tokens.color.dangerBg,
              padding: tokens.spacing[3],
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.sm,
              fontWeight: Number(tokens.fontWeight.bold),
            }}
          >
            {markSentError}
          </div>
        )}
      </Modal>

      <MarkPaidModal
        open={markPaidOpen}
        onClose={() => {
          if (!markPaidSubmitting) {
            setMarkPaidOpen(false);
            setMarkPaidError(null);
          }
        }}
        onConfirm={handleMarkPaid}
        submitting={markPaidSubmitting}
        error={markPaidError}
      />

      <SignatureModal
        open={signOpen}
        onClose={() => setSignOpen(false)}
        docId={invoice.id}
        docType="invoice"
        docNumber={invoice.number ?? null}
        clientName={client?.name ?? "—"}
        signerName={workspace?.name ?? "Signataire"}
        signerEmail={workspace?.email ?? "contact@local"}
        pdfBytes={pdfBytes}
        onSigned={async () => {
          if (invoice.status === "draft") {
            try {
              await invoiceApi.updateStatus(invoice.id, "sent");
            } catch {
              /* ignore — refetch pour mise à jour */
            }
          }
          toast.success(fr.signature.modal.successBody);
          refresh();
        }}
      />

      {client && workspace && (
        <PrepareEmailModal
          open={emailOpen}
          onClose={() => setEmailOpen(false)}
          docType="invoice"
          doc={invoice}
          clientName={client.name}
          clientEmail={client.email}
          workspaceName={workspace.name}
          workspaceEmail={workspace.email}
          renderArgs={{ invoice: toInvoiceInput(invoice), client, workspace }}
        />
      )}
    </div>
  );
}

function buildInvoiceExtras(inv: Invoice): BaseAuditEntry[] {
  const extras: BaseAuditEntry[] = [];
  if (inv.createdAt) {
    extras.push({ kind: "created", timestamp: inv.createdAt });
  }
  if (inv.issuedAt) {
    extras.push({ kind: "sent", timestamp: inv.issuedAt });
  }
  if (inv.paidAt) {
    extras.push({ kind: "paid", timestamp: inv.paidAt });
  }
  return extras;
}

function InvPdfToolbarButton({
  label,
  onClick,
}: { label: string; onClick: () => void }): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "2px 8px",
        border: `1.5px solid ${tokens.color.ink}`,
        background: "transparent",
        fontFamily: tokens.font.ui,
        fontSize: tokens.fontSize.xs,
        fontWeight: Number(tokens.fontWeight.bold),
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        color: tokens.color.ink,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function DescriptionRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): ReactElement {
  return (
    <>
      <dt>
        <DescriptionLabel>{label}</DescriptionLabel>
      </dt>
      <dd
        style={{
          margin: 0,
          fontFamily: tokens.font.mono,
          fontSize: tokens.fontSize.sm,
          fontVariantNumeric: "tabular-nums",
          color: tokens.color.ink,
        }}
      >
        {value}
      </dd>
    </>
  );
}

function DescriptionLabel({
  children,
}: {
  children: React.ReactNode;
}): ReactElement {
  return (
    <span
      style={{
        fontFamily: tokens.font.ui,
        fontSize: tokens.fontSize.xs,
        fontWeight: Number(tokens.fontWeight.bold),
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: tokens.color.muted,
      }}
    >
      {children}
    </span>
  );
}
