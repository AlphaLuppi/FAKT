import { tokens } from "@fakt/design-tokens";
import { TVA_MENTION_MICRO } from "@fakt/legal";
import { formatEur, formatFrDate, formatFrDateLong, fr } from "@fakt/shared";
import type { Client, Quote, Workspace } from "@fakt/shared";
import { Button, Modal, StatusPill, toast } from "@fakt/ui";
import type { StatusKind } from "@fakt/ui";
import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { AuditTimeline, type BaseAuditEntry } from "../../components/audit-timeline/index.js";
import { DesktopOnlyButton } from "../../components/DesktopOnlyButton.js";
import { PrepareEmailModal } from "../../components/prepare-email-modal/index.js";
import { SignatureModal } from "../../components/signature-modal/index.js";
import { clientsApi } from "../../features/doc-editor/clients-api.js";
import { pdfApi } from "../../features/doc-editor/pdf-api.js";
import { quotesApi } from "../../features/doc-editor/quotes-api.js";
import { useClientsList, useQuote, useWorkspace } from "./hooks.js";

function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toQuoteInput(q: Quote): Parameters<typeof pdfApi.renderQuote>[0]["quote"] {
  return {
    id: q.id,
    workspaceId: q.workspaceId,
    clientId: q.clientId,
    number: q.number,
    year: q.year,
    sequence: q.sequence,
    title: q.title,
    status: q.status,
    totalHtCents: q.totalHtCents,
    conditions: q.conditions,
    validityDate: q.validityDate,
    notes: q.notes,
    issuedAt: q.issuedAt,
    signedAt: q.signedAt,
    archivedAt: q.archivedAt,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
    items: q.items,
  };
}

export function QuoteDetailRoute(): ReactElement {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const id = params.id;
  const { quote, loading, error, refresh } = useQuote(id);
  const { workspace } = useWorkspace();
  const { clients } = useClientsList();
  const [client, setClient] = useState<Client | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [markSentOpen, setMarkSentOpen] = useState(false);
  const [markSentSubmitting, setMarkSentSubmitting] = useState(false);
  const [markSentError, setMarkSentError] = useState<string | null>(null);
  const [unmarkSentOpen, setUnmarkSentOpen] = useState(false);
  const [unmarkSentSubmitting, setUnmarkSentSubmitting] = useState(false);
  const [unmarkSentError, setUnmarkSentError] = useState<string | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);

  useEffect(() => {
    if (!quote) return;
    const inList = clients.find((c) => c.id === quote.clientId);
    if (inList) {
      setClient(inList);
      return;
    }
    let cancelled = false;
    clientsApi
      .get(quote.clientId)
      .then((c) => {
        if (!cancelled) setClient(c);
      })
      .catch(() => {
        if (!cancelled) setClient(null);
      });
    return (): void => {
      cancelled = true;
    };
  }, [quote, clients]);

  useEffect(() => {
    if (!quote || !client || !workspace) return;
    if (!quote.number || !quote.issuedAt) {
      setPdfUrl(null);
      return;
    }

    let cancelled = false;
    let revoke: string | null = null;
    setPdfError(null);

    pdfApi
      .renderQuote({
        quote: toQuoteInput(quote),
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
          setPdfError(err instanceof Error ? err.message : fr.quotes.errors.pdfFailed);
        }
      });

    return (): void => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [quote, client, workspace]);

  async function handleMarkSent(): Promise<void> {
    if (!quote) return;
    // Guard synchrone double-submit : un double-clic sur "Émettre" allouait
    // 2 numéros séquentiels (seq 1 + seq 2) pour un seul devis côté UI.
    if (markSentSubmitting) return;
    setMarkSentSubmitting(true);
    setMarkSentError(null);
    try {
      await quotesApi.updateStatus(quote.id, "sent");
      setMarkSentOpen(false);
      toast.success(fr.quotes.detail.markSentSuccess);
      refresh();
    } catch (err) {
      setMarkSentError(err instanceof Error ? err.message : fr.quotes.detail.markSentError);
    } finally {
      setMarkSentSubmitting(false);
    }
  }

  async function handleUnmarkSent(): Promise<void> {
    if (!quote) return;
    if (unmarkSentSubmitting) return;
    setUnmarkSentSubmitting(true);
    setUnmarkSentError(null);
    try {
      await quotesApi.updateStatus(quote.id, "draft");
      setUnmarkSentOpen(false);
      toast.success(fr.quotes.detail.unmarkSentSuccess);
      refresh();
    } catch (err) {
      setUnmarkSentError(err instanceof Error ? err.message : fr.quotes.detail.unmarkSentError);
    } finally {
      setUnmarkSentSubmitting(false);
    }
  }

  async function handleDownload(): Promise<void> {
    if (!quote || !client || !workspace) return;
    try {
      const bytes = await pdfApi.renderQuote({
        quote: toQuoteInput(quote),
        client,
        workspace,
      });
      const filename = `Devis-${quote.number ?? "draft"}-${slugify(client.name)}.pdf`;
      const path = await pdfApi.saveDialog(filename);
      if (!path) return; // user annule dialog, pas d'erreur
      try {
        await pdfApi.writeFile(path, bytes);
        toast.success(fr.quotes.detail.pdfSaved);
      } catch (err) {
        const msg = err instanceof Error ? err.message : fr.quotes.detail.pdfSaveFailed;
        setPdfError(msg);
        toast.error(`${fr.quotes.detail.pdfSaveFailed} — ${msg}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : fr.quotes.errors.pdfFailed;
      setPdfError(msg);
      toast.error(msg);
    }
  }

  const isDraft = quote?.status === "draft";

  const metadata = useMemo(() => {
    if (!quote) return [];
    const rows: Array<[string, string]> = [
      [fr.quotes.labels.number, quote.number ?? fr.quotes.labels.numberPending],
      [fr.quotes.labels.client, client?.name ?? "—"],
      [fr.quotes.labels.totalHt, formatEur(quote.totalHtCents)],
      [fr.quotes.labels.issuedAt, quote.issuedAt ? formatFrDateLong(quote.issuedAt) : "—"],
      [
        fr.quotes.labels.validityDate,
        quote.validityDate ? formatFrDateLong(quote.validityDate) : "—",
      ],
      [fr.quotes.labels.createdAt, formatFrDate(quote.createdAt)],
    ];
    if (quote.signedAt) {
      rows.push([fr.quotes.detail.signedOn, formatFrDateLong(quote.signedAt)]);
    }
    return rows;
  }, [quote, client]);

  if (loading) {
    return <div style={{ padding: tokens.spacing[6] }}>Chargement…</div>;
  }

  if (error || !quote) {
    return (
      <div style={{ padding: tokens.spacing[6] }} data-testid="detail-not-found">
        {fr.quotes.errors.notFound}
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
              {quote.number ?? fr.quotes.labels.numberPending}
            </h1>
            <StatusPill status={quote.status as StatusKind} />
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
            {quote.title}
          </p>
        </div>
        <div style={{ display: "flex", gap: tokens.spacing[2] }}>
          <Button variant="ghost" onClick={() => void navigate("/quotes")}>
            {fr.quotes.actions.backToList}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void navigate(`/quotes/${quote.id}/edit`)}
            disabled={!isDraft}
            title={isDraft ? undefined : fr.quotes.detail.editDisabledTooltip}
            aria-label={isDraft ? fr.quotes.actions.edit : fr.quotes.detail.editDisabledTooltip}
            data-testid="detail-edit"
          >
            {fr.quotes.actions.edit}
          </Button>
          {!isDraft && (
            <Button
              variant="secondary"
              onClick={() => void navigate(`/quotes/new?duplicateOf=${quote.id}`)}
              title={fr.quotes.detail.duplicateHint}
              data-testid="detail-duplicate"
            >
              {fr.quotes.actions.duplicate}
            </Button>
          )}
          <Button
            variant="primary"
            onClick={() => void handleDownload()}
            disabled={!quote.number}
            data-testid="detail-download"
          >
            {fr.quotes.actions.downloadPdf}
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
          aria-label={fr.quotes.detail.previewTitle}
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
            <span>{fr.quotes.detail.previewTitle}</span>
            {pdfUrl && (
              <div style={{ display: "flex", gap: tokens.spacing[2] }}>
                <PdfToolbarButton
                  label="Zoom +"
                  onClick={() => {
                    const iframe = document.querySelector<HTMLIFrameElement>(
                      "[data-testid='pdf-iframe']"
                    );
                    if (iframe?.contentWindow)
                      iframe.contentWindow.document.body.style.zoom = "1.2";
                  }}
                />
                <PdfToolbarButton
                  label="Zoom -"
                  onClick={() => {
                    const iframe = document.querySelector<HTMLIFrameElement>(
                      "[data-testid='pdf-iframe']"
                    );
                    if (iframe?.contentWindow)
                      iframe.contentWindow.document.body.style.zoom = "0.8";
                  }}
                />
                <PdfToolbarButton
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
                title={fr.quotes.detail.previewTitle}
                src={pdfUrl}
                data-testid="pdf-iframe"
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
                data-testid="pdf-placeholder"
              >
                {pdfError ?? (isDraft ? fr.quotes.detail.noPdfDraft : fr.quotes.detail.noPdf)}
              </div>
            )}
          </div>
        </section>

        <aside
          aria-label={fr.quotes.detail.infosTitle}
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
            {fr.quotes.detail.infosTitle}
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

          {quote.notes && (
            <div>
              <DescriptionLabel>{fr.quotes.labels.notes}</DescriptionLabel>
              <div
                style={{
                  fontFamily: tokens.font.ui,
                  fontSize: tokens.fontSize.sm,
                  color: tokens.color.ink,
                  whiteSpace: "pre-wrap",
                  marginTop: tokens.spacing[1],
                }}
              >
                {quote.notes}
              </div>
            </div>
          )}

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
              borderTop: `${tokens.stroke.base} solid ${tokens.color.ink}`,
              paddingTop: tokens.spacing[3],
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.xs,
              fontWeight: Number(tokens.fontWeight.bold),
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: tokens.color.ink,
            }}
          >
            {fr.quotes.footer.signature}
          </div>

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
              docType="quote"
              docId={quote.id}
              extraEntries={buildQuoteExtras(quote)}
            />
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
            {isDraft ? (
              <Button
                variant="primary"
                onClick={() => setMarkSentOpen(true)}
                disabled={!quote.number}
                data-testid="detail-mark-sent"
              >
                {fr.quotes.actions.markSent}
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => setEmailOpen(true)}
                disabled={!quote.number}
                data-testid="detail-prepare-email"
              >
                {fr.email.actions.openInMail}
              </Button>
            )}
            {quote.status === "sent" && (
              <Button
                variant="ghost"
                onClick={() => setUnmarkSentOpen(true)}
                data-testid="detail-unmark-sent"
              >
                {fr.quotes.actions.unmarkSent}
              </Button>
            )}
            {(quote.status === "draft" || quote.status === "sent") && (
              <DesktopOnlyButton
                variant="secondary"
                onClick={() => setSignOpen(true)}
                disabled={!quote.number || !pdfBytes || pdfBytes.byteLength === 0}
                data-testid="detail-sign"
              >
                {fr.quotes.actions.sign}
              </DesktopOnlyButton>
            )}
          </div>
        </aside>
      </div>

      <Modal
        open={markSentOpen}
        title={fr.quotes.detail.markSentTitle}
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
              data-testid="detail-mark-sent-cancel"
            >
              {fr.quotes.actions.cancel}
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleMarkSent()}
              disabled={markSentSubmitting}
              data-testid="detail-mark-sent-confirm"
            >
              {fr.quotes.actions.confirm}
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
          {fr.quotes.detail.markSentBody}
        </p>
        {markSentError && (
          <div
            role="alert"
            data-testid="detail-mark-sent-error"
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

      <Modal
        open={unmarkSentOpen}
        title={fr.quotes.detail.unmarkSentTitle}
        onClose={() => {
          if (!unmarkSentSubmitting) {
            setUnmarkSentOpen(false);
            setUnmarkSentError(null);
          }
        }}
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setUnmarkSentOpen(false);
                setUnmarkSentError(null);
              }}
              disabled={unmarkSentSubmitting}
              data-testid="detail-unmark-sent-cancel"
            >
              {fr.quotes.actions.cancel}
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleUnmarkSent()}
              disabled={unmarkSentSubmitting}
              data-testid="detail-unmark-sent-confirm"
            >
              {fr.quotes.actions.confirm}
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
          {fr.quotes.detail.unmarkSentBody}
        </p>
        {unmarkSentError && (
          <div
            role="alert"
            data-testid="detail-unmark-sent-error"
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
            {unmarkSentError}
          </div>
        )}
      </Modal>

      <SignatureModal
        open={signOpen}
        onClose={() => setSignOpen(false)}
        docId={quote.id}
        docType="quote"
        docNumber={quote.number ?? null}
        clientName={client?.name ?? "—"}
        signerName={workspace?.name ?? "Signataire"}
        signerEmail={workspace?.email ?? "contact@local"}
        pdfBytes={pdfBytes}
        onSigned={async () => {
          try {
            await quotesApi.updateStatus(quote.id, "signed");
          } catch (err) {
            // Si la transition directe échoue (devis en draft), on tente sent puis signed.
            if (quote.status === "draft") {
              try {
                await quotesApi.updateStatus(quote.id, "sent");
                await quotesApi.updateStatus(quote.id, "signed");
              } catch {
                /* ignore — l'UI refetch montrera l'état réel */
              }
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
          docType="quote"
          doc={quote}
          clientName={client.name}
          clientEmail={client.email}
          workspaceName={workspace.name}
          workspaceEmail={workspace.email}
          renderArgs={{ quote: toQuoteInput(quote), client, workspace }}
        />
      )}
    </div>
  );
}

function buildQuoteExtras(q: Quote): BaseAuditEntry[] {
  const extras: BaseAuditEntry[] = [];
  if (q.createdAt) {
    extras.push({ kind: "created", timestamp: q.createdAt });
  }
  if (q.issuedAt) {
    extras.push({ kind: "sent", timestamp: q.issuedAt });
  }
  return extras;
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

function PdfToolbarButton({
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

// Pour éviter le tree-shaking du Workspace et la marking dans typecheck.
export type { Workspace };
