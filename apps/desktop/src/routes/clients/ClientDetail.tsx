import type { ReactElement, ReactNode } from "react";
import { Modal, Button, StatusPill } from "@fakt/ui";
import { fr } from "@fakt/shared";
import type { Client, Quote, Invoice } from "@fakt/shared";

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
  if (!client) return <></>;

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
            {client.siret && (
              <InfoRow
                label={fr.clients.labels.siret}
                value={client.siret}
                mono
              />
            )}
            {client.contactName && (
              <InfoRow label={fr.clients.labels.contactName} value={client.contactName} />
            )}
            {client.email && (
              <InfoRow label={fr.clients.labels.email} value={client.email} />
            )}
            {client.sector && (
              <InfoRow label={fr.clients.labels.sector} value={client.sector} />
            )}
            {client.address && (
              <InfoRow label={fr.clients.labels.address} value={client.address} />
            )}
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
              {quotes.slice(0, 5).map((q) => (
                <CompactRow key={q.id}>
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
              {invoices.slice(0, 5).map((inv) => (
                <CompactRow key={inv.id}>
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

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }): ReactElement {
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
  return (
    <div style={{ fontSize: 12, color: "var(--muted)", padding: "8px 0" }}>
      {children}
    </div>
  );
}

function CompactList({ children }: { children: ReactNode }): ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {children}
    </div>
  );
}

function CompactRow({ children }: { children: ReactNode }): ReactElement {
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
