import { tokens } from "@fakt/design-tokens";
import { fr } from "@fakt/shared";
import type { Invoice, Quote } from "@fakt/shared";
import type { Client } from "@fakt/shared";
import { Button, Modal, toast } from "@fakt/ui";
import { invoke } from "@tauri-apps/api/core";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { api } from "../../api/index.js";
import { invoiceApi } from "../../features/doc-editor/invoice-api.js";
import { pdfApi } from "../../features/doc-editor/pdf-api.js";
import { quotesApi } from "../../features/doc-editor/quotes-api.js";
import { useWorkspace } from "../quotes/hooks.js";

function buildReadme(workspaceName: string, siret: string, isoDate: string): string {
  return `FAKT -- Archive workspace
=========================

Date export : ${isoDate}
Workspace   : ${workspaceName} (SIRET ${siret})

Contenu
-------
- clients.csv       : liste des clients actifs et archives
- prestations.csv   : bibliotheque de prestations
- quotes/           : tous les devis emis (PDF)
- invoices/         : toutes les factures emises (PDF)

Conformite legale
-----------------
Les factures emises doivent etre conservees pendant 10 ans
(article L123-22 du Code de Commerce + article 286 du CGI).
Les devis ne sont pas soumis a cette obligation mais sont
inclus dans l'archive pour tracabilite commerciale.

La suppression d'une facture emise est interdite par FAKT
(contrainte DB et UI). Seul l'archivage soft (champ archived_at)
est autorise, le document reste consultable en lecture.

Pour restaurer ou verifier l'integrite d'une signature PAdES,
ouvrir le PDF correspondant dans Adobe Reader ou equivalent.

FAKT v0.1.0 -- AlphaLuppi -- https://fakt.alphaluppi.com`;
}

function buildClientsCsv(
  clients: Array<{
    id: string;
    name: string;
    email: string | null;
    siret: string | null;
    address: string | null;
    contactName: string | null;
  }>
): string {
  const header = "id,nom,contact,email,siret,adresse\n";
  const rows = clients
    .map((c) =>
      [
        c.id,
        csvEscape(c.name),
        csvEscape(c.contactName ?? ""),
        csvEscape(c.email ?? ""),
        csvEscape(c.siret ?? ""),
        csvEscape(c.address ?? ""),
      ].join(",")
    )
    .join("\n");
  return header + rows;
}

function buildPrestationsCsv(
  services: Array<{ id: string; name: string; unit: string; unitPriceCents: number }>
): string {
  const header = "id,nom,unite,prix_ttc_cents,categorie\n";
  const rows = services
    .map((s) => [s.id, csvEscape(s.name), s.unit, s.unitPriceCents, ""].join(","))
    .join("\n");
  return header + rows;
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function ArchiveRoute(): ReactElement {
  const { workspace } = useWorkspace();
  const [clients, setClients] = useState<Client[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const [qs, invs, cls] = await Promise.all([
          quotesApi.list({ limit: 10000 }),
          invoiceApi.list({ limit: 10000 }),
          api.clients.list({ includeSoftDeleted: true, limit: 10000 }).catch(() => []),
        ]);
        if (!cancelled) {
          setQuotes(qs.filter((q) => q.number !== null));
          setInvoices(invs.filter((inv) => inv.number !== null));
          setClients(cls);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return (): void => {
      cancelled = true;
    };
  }, []);

  const issuedQuotes = quotes.filter((q) => q.number !== null);
  const issuedInvoices = invoices.filter((inv) => inv.number !== null);
  const estimatedSizeMb = ((issuedQuotes.length + issuedInvoices.length) * 50) / 1024;

  async function handleExport(): Promise<void> {
    if (!workspace) return;
    setExporting(true);
    setProgress(0);
    setConfirmOpen(false);

    try {
      const total = issuedQuotes.length + issuedInvoices.length;
      let done = 0;

      const pdfsQuotes: Array<{ name: string; bytes: number[] }> = [];
      for (const q of issuedQuotes) {
        const client = clients.find((c) => c.id === q.clientId);
        if (!client) {
          done++;
          setProgress(Math.round((done / total) * 90));
          continue;
        }
        try {
          const bytes = await pdfApi.renderQuote({
            quote: q as Parameters<typeof pdfApi.renderQuote>[0]["quote"],
            client,
            workspace,
          });
          pdfsQuotes.push({ name: `${q.number}.pdf`, bytes: Array.from(bytes) });
        } catch {
          /* skip en cas d'erreur de rendu */
        }
        done++;
        setProgress(Math.round((done / total) * 90));
      }

      const pdfsInvoices: Array<{ name: string; bytes: number[] }> = [];
      for (const inv of issuedInvoices) {
        const client = clients.find((c) => c.id === inv.clientId);
        if (!client) {
          done++;
          setProgress(Math.round((done / total) * 90));
          continue;
        }
        try {
          const bytes = await pdfApi.renderInvoice({
            invoice: inv as Parameters<typeof pdfApi.renderInvoice>[0]["invoice"],
            client,
            workspace,
          });
          pdfsInvoices.push({ name: `${inv.number}.pdf`, bytes: Array.from(bytes) });
        } catch {
          /* skip */
        }
        done++;
        setProgress(Math.round((done / total) * 90));
      }

      const isoDate = new Date().toISOString().slice(0, 10);
      const readme = buildReadme(workspace.name, workspace.siret, isoDate);

      const csvClients = buildClientsCsv(clients);
      const services = await api.services
        .list({ includeSoftDeleted: true, limit: 10000 })
        .catch(() => []);
      const csvPrestations = buildPrestationsCsv(services);

      const destPath = await invoke<string | null>("plugin:dialog|save", {
        options: {
          defaultPath: `fakt-workspace-${isoDate}.zip`,
          filters: [{ name: "ZIP", extensions: ["zip"] }],
        },
      }).catch(() => null);

      if (!destPath) {
        setExporting(false);
        setProgress(0);
        return;
      }

      setProgress(95);

      const zipPath = await invoke<string>("build_workspace_zip", {
        payload: {
          csv_clients: csvClients,
          csv_prestations: csvPrestations,
          pdfs_quotes: pdfsQuotes,
          pdfs_invoices: pdfsInvoices,
          readme,
          workspace_name: workspace.name,
        },
        destPath,
      });

      setProgress(100);
      toast.success(`${fr.archive.exportSuccess} ${zipPath}`);
    } catch (err) {
      toast.error(fr.errors.generic);
      console.error("export zip failed", err);
    } finally {
      setExporting(false);
      setProgress(0);
    }
  }

  return (
    <div
      data-testid="archive-root"
      style={{
        padding: tokens.spacing[6],
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacing[5],
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
            {fr.archive.title}
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
            {fr.archive.subtitle}
          </p>
        </div>
        <div
          style={{
            border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
            padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`,
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.xs,
            fontWeight: Number(tokens.fontWeight.bold),
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {fr.archive.legalBadge}
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: tokens.spacing[4],
        }}
      >
        <StatCard
          testId="archive-stat-quotes"
          label={fr.archive.stats.quotesIssued}
          value={String(issuedQuotes.length)}
        />
        <StatCard
          testId="archive-stat-invoices"
          label={fr.archive.stats.invoicesIssued}
          value={String(issuedInvoices.length)}
        />
        <StatCard
          testId="archive-stat-size"
          label={fr.archive.stats.estimatedSize}
          value={`~${estimatedSizeMb.toFixed(1)} Mo`}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="primary"
          onClick={() => setConfirmOpen(true)}
          disabled={exporting || loading}
          data-testid="archive-export-btn"
        >
          {exporting ? fr.archive.actions.exporting : fr.archive.actions.export}
        </Button>
      </div>

      {exporting && (
        <div
          data-testid="archive-export-progress"
          style={{
            border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
            height: 20,
            background: tokens.color.paper2,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              height: "100%",
              width: `${progress}%`,
              background: tokens.color.ink,
              transition: "width 0.2s",
            }}
          />
          <span
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%,-50%)",
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.xs,
              fontWeight: Number(tokens.fontWeight.bold),
              color: progress > 50 ? tokens.color.surface : tokens.color.ink,
              mixBlendMode: "difference",
            }}
          >
            {progress}%
          </span>
        </div>
      )}

      <section>
        <h2
          style={{
            font: `${tokens.fontWeight.black} ${tokens.fontSize.md}/1 ${tokens.font.ui}`,
            textTransform: "uppercase",
            letterSpacing: "-0.01em",
            margin: `0 0 ${tokens.spacing[3]} 0`,
          }}
        >
          {fr.archive.recentTitle}
        </h2>
        <div
          style={{
            border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
            background: tokens.color.surface,
            boxShadow: tokens.shadow.sm,
          }}
        >
          {loading ? (
            <div
              style={{
                padding: tokens.spacing[5],
                textAlign: "center",
                fontFamily: tokens.font.ui,
                fontSize: tokens.fontSize.sm,
                color: tokens.color.muted,
              }}
            >
              {fr.archive.loading}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {[fr.archive.table.type, fr.archive.table.number, fr.archive.table.issuedAt].map(
                    (col) => (
                      <th
                        key={col}
                        style={{
                          padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
                          borderBottom: `${tokens.stroke.base} solid ${tokens.color.ink}`,
                          fontFamily: tokens.font.ui,
                          fontSize: tokens.fontSize.xs,
                          fontWeight: Number(tokens.fontWeight.bold),
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          textAlign: "left",
                          color: tokens.color.muted,
                        }}
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {[
                  ...issuedQuotes
                    .slice(-10)
                    .map((q) => ({ type: "Devis", number: q.number, issuedAt: q.issuedAt })),
                  ...issuedInvoices.slice(-10).map((inv) => ({
                    type: "Facture",
                    number: inv.number,
                    issuedAt: inv.issuedAt,
                  })),
                ]
                  .sort((a, b) => (b.issuedAt ?? 0) - (a.issuedAt ?? 0))
                  .slice(0, 15)
                  .map((row) => (
                    <tr
                      key={`${row.type}-${row.number}`}
                      data-testid={`archive-row-${row.type.toLowerCase()}-${row.number}`}
                      style={{
                        borderBottom: `${tokens.stroke.hair} solid ${tokens.color.ink}`,
                      }}
                    >
                      <td
                        style={{
                          padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
                          fontFamily: tokens.font.ui,
                          fontSize: tokens.fontSize.sm,
                          color: tokens.color.muted,
                        }}
                      >
                        {row.type}
                      </td>
                      <td
                        style={{
                          padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
                          fontFamily: tokens.font.mono,
                          fontSize: tokens.fontSize.sm,
                        }}
                      >
                        {row.number}
                      </td>
                      <td
                        style={{
                          padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
                          fontFamily: tokens.font.ui,
                          fontSize: tokens.fontSize.sm,
                          color: tokens.color.muted,
                        }}
                      >
                        {row.issuedAt ? new Date(row.issuedAt).toLocaleDateString("fr-FR") : "—"}
                      </td>
                    </tr>
                  ))}
                {issuedQuotes.length === 0 && issuedInvoices.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      style={{
                        padding: tokens.spacing[5],
                        textAlign: "center",
                        fontFamily: tokens.font.ui,
                        fontSize: tokens.fontSize.sm,
                        color: tokens.color.muted,
                      }}
                    >
                      {fr.archive.empty}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <Modal
        open={confirmOpen}
        title={fr.archive.confirmModal.title}
        onClose={() => setConfirmOpen(false)}
        size="sm"
        data-testid="archive-confirm-modal"
        testIdContent="archive-confirm-modal-content"
        testIdClose="archive-confirm-modal-close"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              data-testid="archive-confirm-cancel"
            >
              {fr.archive.actions.cancel}
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleExport()}
              data-testid="archive-confirm-export"
            >
              {fr.archive.actions.confirm}
            </Button>
          </>
        }
      >
        <p
          style={{
            margin: 0,
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.sm,
            lineHeight: 1.5,
          }}
        >
          {fr.archive.confirmModal.body(issuedQuotes.length, issuedInvoices.length)}
        </p>
      </Modal>
    </div>
  );
}

function StatCard({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}): ReactElement {
  return (
    <div
      data-testid={testId}
      style={{
        border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
        background: tokens.color.surface,
        boxShadow: tokens.shadow.sm,
        padding: tokens.spacing[4],
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
          marginBottom: tokens.spacing[1],
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: tokens.font.mono,
          fontSize: tokens.fontSize["2xl"],
          fontWeight: Number(tokens.fontWeight.black),
          color: tokens.color.ink,
        }}
      >
        {value}
      </div>
    </div>
  );
}
