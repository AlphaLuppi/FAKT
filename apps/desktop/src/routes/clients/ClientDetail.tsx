import { fr } from "@fakt/shared";
import type { Client, Invoice, Quote } from "@fakt/shared";
import { Button, Modal, StatusPill } from "@fakt/ui";
import type { ReactElement, ReactNode } from "react";
import { useNavigate } from "react-router";

/** Plafond d'items par liste dans la modale détail client. */
const MAX_PREVIEW_ITEMS = 5;

interface ClientDetailProps {
  open: boolean;
  onClose: () => void;
  client: Client | null;
  quotes: Quote[];
  invoices: Invoice[];
  onEdit: () => void;
  onDelete: () => void;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(fr.format.dateLocale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat(fr.format.currencyLocale, {
    style: "currency",
    currency: fr.format.currency,
  }).format(cents / 100);
}

export function ClientDetail({
  open,
  onClose,
  client,
  quotes,
  invoices,
  onEdit,
  onDelete,
}: ClientDetailProps): ReactElement {
  const navigate = useNavigate();

  if (!client) return <></>;

  function goToQuote(id: string): void {
    onClose();
    void navigate(`/quotes/${id}`);
  }

  function goToInvoice(id: string): void {
    onClose();
    void navigate(`/invoices/${id}`);
  }

  function goToQuotesFilteredByClient(clientId: string): void {
    onClose();
    void navigate(`/quotes?client=${encodeURIComponent(clientId)}`);
  }

  function goToInvoicesFilteredByClient(clientId: string): void {
    onClose();
    void navigate(`/invoices?client=${encodeURIComponent(clientId)}`);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={client.name}
      size="lg"
      footer={
        <>
          <Button variant="danger" onClick={onDelete}>
            Archiver
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
          <Button variant="primary" onClick={onEdit}>
            {fr.clients.actions.edit}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Infos client */}
        <section>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {client.legalForm && (
              <InfoRow label={fr.clients.labels.legalForm} value={client.legalForm} />
            )}
            {client.siret && <InfoRow label={fr.clients.labels.siret} value={client.siret} mono />}
            {client.contactName && (
              <InfoRow label={fr.clients.labels.contactName} value={client.contactName} />
            )}
            {client.email && <InfoRow label={fr.clients.labels.email} value={client.email} />}
            {client.sector && <InfoRow label={fr.clients.labels.sector} value={client.sector} />}
            {client.address && <InfoRow label={fr.clients.labels.address} value={client.address} />}
          </div>
          {client.note && (
            <div style={{ marginTop: 12 }}>
              <InfoRow label={fr.clients.labels.note} value={client.note} />
            </div>
          )}
        </section>

        {/* Devis liés */}
        <section>
          <SectionTitle>Devis liés ({quotes.length})</SectionTitle>
          {quotes.length === 0 ? (
            <Empty>Aucun devis pour ce client.</Empty>
          ) : (
            <CompactList>
              {quotes.slice(0, MAX_PREVIEW_ITEMS).map((q) => (
                <CompactRow
                  key={q.id}
                  onClick={(): void => goToQuote(q.id)}
                  label={`Ouvrir le devis ${q.number ?? "brouillon"}`}
                  testId={`client-detail-quote-${q.id}`}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                    {q.number ?? "—"}
                  </span>
                  <span style={{ flex: 1, fontSize: 13 }}>{q.title}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                    {formatCents(q.totalHtCents)}
                  </span>
                  <StatusPill status={q.status} size="sm" />
                </CompactRow>
              ))}
              {quotes.length > MAX_PREVIEW_ITEMS && (
                <MoreLink
                  onClick={(): void => goToQuotesFilteredByClient(client.id)}
                  testId="client-detail-more-quotes"
                >
                  Voir les {quotes.length} devis de ce client →
                </MoreLink>
              )}
            </CompactList>
          )}
        </section>

        {/* Factures liées */}
        <section>
          <SectionTitle>Factures liées ({invoices.length})</SectionTitle>
          {invoices.length === 0 ? (
            <Empty>Aucune facture pour ce client.</Empty>
          ) : (
            <CompactList>
              {invoices.slice(0, MAX_PREVIEW_ITEMS).map((inv) => (
                <CompactRow
                  key={inv.id}
                  onClick={(): void => goToInvoice(inv.id)}
                  label={`Ouvrir la facture ${inv.number ?? "brouillon"}`}
                  testId={`client-detail-invoice-${inv.id}`}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                    {inv.number ?? "—"}
                  </span>
                  <span style={{ flex: 1, fontSize: 13 }}>{inv.title}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                    {formatCents(inv.totalHtCents)}
                  </span>
                  <StatusPill status={inv.status} size="sm" />
                  {inv.dueDate && (
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>
                      éch. {formatDate(inv.dueDate)}
                    </span>
                  )}
                </CompactRow>
              ))}
              {invoices.length > MAX_PREVIEW_ITEMS && (
                <MoreLink
                  onClick={(): void => goToInvoicesFilteredByClient(client.id)}
                  testId="client-detail-more-invoices"
                >
                  Voir les {invoices.length} factures de ce client →
                </MoreLink>
              )}
            </CompactList>
          )}
        </section>

        <div style={{ fontSize: 11, color: "var(--muted)" }}>
          Client depuis le {formatDate(client.createdAt)}
        </div>
      </div>
    </Modal>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: { label: string; value: string; mono?: boolean }): ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--muted)",
          fontFamily: "var(--font-ui)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          color: "var(--ink)",
          fontFamily: mono ? "var(--font-mono)" : "var(--font-ui)",
          whiteSpace: "pre-wrap",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }): ReactElement {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--muted)",
        fontFamily: "var(--font-ui)",
        borderBottom: "1.5px solid var(--line)",
        paddingBottom: 6,
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }): ReactElement {
  return <div style={{ fontSize: 12, color: "var(--muted)", padding: "8px 0" }}>{children}</div>;
}

function CompactList({ children }: { children: ReactNode }): ReactElement {
  return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>{children}</div>;
}

function CompactRow({
  children,
  onClick,
  label,
  testId,
}: {
  children: ReactNode;
  onClick?: () => void;
  label?: string;
  testId?: string;
}): ReactElement {
  if (!onClick) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "6px 8px",
          border: "1.5px solid var(--line)",
          background: "var(--paper)",
        }}
      >
        {children}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-testid={testId}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 8px",
        border: "1.5px solid var(--line)",
        background: "var(--paper)",
        textAlign: "left",
        cursor: "pointer",
        width: "100%",
        font: "inherit",
        color: "inherit",
      }}
      onKeyDown={(e): void => {
        // Enter/Space déclenchent le clic — comportement natif button déjà OK
        // mais on garde explicite pour une cohérence éventuelle.
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {children}
    </button>
  );
}

function MoreLink({
  onClick,
  children,
  testId,
}: {
  onClick: () => void;
  children: ReactNode;
  testId?: string;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      style={{
        alignSelf: "flex-end",
        border: "none",
        background: "transparent",
        padding: "4px 0",
        marginTop: 4,
        fontFamily: "var(--font-ui)",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: "var(--ink)",
        cursor: "pointer",
        textDecoration: "underline",
      }}
    >
      {children}
    </button>
  );
}
