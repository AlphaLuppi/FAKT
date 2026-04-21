import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { tokens } from "@fakt/design-tokens";
import { Button, StatusPill } from "@fakt/ui";
import type { StatusKind } from "@fakt/ui";
import {
  fr,
  formatEur,
  formatFrDateLong,
  formatFrDate,
} from "@fakt/shared";
import type { Client, Invoice } from "@fakt/shared";
import { TVA_MENTION_MICRO } from "@fakt/legal";
import { useInvoice } from "./hooks.js";
import { useWorkspace, useClientsList } from "../quotes/hooks.js";
import { invoiceApi } from "../../features/doc-editor/invoice-api.js";
import { clientsApi } from "../../features/doc-editor/clients-api.js";
import { pdfApi } from "../../features/doc-editor/pdf-api.js";
import { invalidateSearchIndex } from "../../components/command-palette/useCommandPaletteIndex.js";

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
  const { invoice, loading, error } = useInvoice(id);
  const { workspace } = useWorkspace();
  const { clients } = useClientsList();
  const [client, setClient] = useState<Client | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
        const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        revoke = url;
        setPdfUrl(url);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setPdfError(
            err instanceof Error ? err.message : fr.invoices.errors.pdfFailed,
          );
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
      if (path) {
        await pdfApi.writeFile(path, bytes);
      }
    } catch (err) {
      setPdfError(
        err instanceof Error ? err.message : fr.invoices.errors.pdfFailed,
      );
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
      setDeleteError(
        err instanceof Error ? err.message : fr.invoices.errors.deleteIssued,
      );
    }
  }

  const isDraft = invoice?.status === "draft";

  const metadata = useMemo(() => {
    if (!invoice) return [];
    const rows: Array<[string, string]> = [
      [fr.invoices.labels.number, invoice.number ?? fr.invoices.labels.numberPending],
      [fr.invoices.labels.client, client?.name ?? "—"],
      [fr.invoices.labels.kind, fr.invoices.kind[invoice.kind]],
      [fr.invoices.labels.totalHt, formatEur(invoice.totalHtCents)],
      [
        fr.invoices.labels.issuedAt,
        invoice.issuedAt ? formatFrDateLong(invoice.issuedAt) : "—",
      ],
      [
        fr.invoices.labels.dueDate,
        invoice.dueDate ? formatFrDateLong(invoice.dueDate) : "—",
      ],
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
      <div
        style={{ padding: tokens.spacing[6] }}
        data-testid="invoice-detail-not-found"
      >
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
            <StatusPill status={invoice.status as StatusKind} />
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
              padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
              borderBottom: `${tokens.stroke.base} solid ${tokens.color.ink}`,
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.xs,
              fontWeight: Number(tokens.fontWeight.bold),
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              background: tokens.color.surface,
            }}
          >
            {fr.invoices.detail.previewTitle}
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
                {pdfError ??
                  (isDraft
                    ? fr.invoices.detail.noPdfDraft
                    : fr.invoices.detail.noPdf)}
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
            <Button
              variant="secondary"
              disabled
              data-testid="invoice-detail-send-stub"
              title="Track K / H3"
            >
              {fr.invoices.actions.send}
            </Button>
            <Button
              variant="secondary"
              disabled
              data-testid="invoice-detail-markpaid-stub"
              title="Track H3"
            >
              {fr.invoices.actions.markPaid}
            </Button>
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
        </aside>
      </div>
    </div>
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
