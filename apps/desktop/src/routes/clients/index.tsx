import { tokens } from "@fakt/design-tokens";
import { fr } from "@fakt/shared";
import type { Client, Invoice, Quote } from "@fakt/shared";
import { Button, Chip, StatusPill, Table } from "@fakt/ui";
import type { TableColumn } from "@fakt/ui";
import type { ReactElement } from "react";
import { useCallback, useMemo, useState } from "react";
import { useClientInvoices, useClientQuotes, useClients } from "../../hooks/useClients.js";
import { ClientDetail } from "./ClientDetail.js";
import { ClientForm } from "./ClientForm.js";
import type { ClientFormValues } from "./ClientForm.js";

export function ClientsRoute(): ReactElement {
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const { clients, createClient, updateClient, deleteClient, restoreClient } = useClients({
    search,
    includeSoftDeleted: showArchived,
  });

  const { quotes: selectedQuotes } = useClientQuotes(selectedClient?.id ?? null);
  const { invoices: selectedInvoices } = useClientInvoices(selectedClient?.id ?? null);

  const handleNewClient = (): void => {
    setSelectedClient(null);
    setFormOpen(true);
  };

  const handleRowClick = (client: Client): void => {
    setSelectedClient(client);
    setDetailOpen(true);
  };

  const handleEditFromDetail = (): void => {
    setDetailOpen(false);
    setFormOpen(true);
  };

  const handleDeleteFromDetail = (): void => {
    if (!selectedClient) return;
    void deleteClient(selectedClient.id);
    setDetailOpen(false);
  };

  const handleFormSubmit = useCallback(
    async (values: ClientFormValues): Promise<void> => {
      if (selectedClient) {
        await updateClient(selectedClient.id, {
          name: values.name,
          legalForm: values.legalForm ?? null,
          siret: values.siret?.trim() ? values.siret.trim() : null,
          address: values.address ?? null,
          contactName: values.contactName ?? null,
          email: values.email?.trim() ? values.email.trim() : null,
          sector: values.sector ?? null,
          note: values.note ?? null,
        });
      } else {
        await createClient({
          name: values.name,
          legalForm: values.legalForm ?? null,
          siret: values.siret?.trim() ? values.siret.trim() : null,
          address: values.address ?? null,
          contactName: values.contactName ?? null,
          email: values.email?.trim() ? values.email.trim() : null,
          sector: values.sector ?? null,
          note: values.note ?? null,
        });
      }
    },
    [selectedClient, createClient, updateClient]
  );

  const columns = useMemo(
    (): TableColumn<Client>[] => [
      {
        id: "name",
        header: fr.clients.labels.name,
        accessor: (c) => <span style={{ fontWeight: 700, color: "var(--ink)" }}>{c.name}</span>,
        sortValue: (c) => c.name,
        sortable: true,
      },
      {
        id: "contactName",
        header: fr.clients.labels.contactName,
        accessor: (c) => c.contactName ?? "—",
        sortValue: (c) => c.contactName ?? "",
        sortable: true,
      },
      {
        id: "email",
        header: fr.clients.labels.email,
        accessor: (c) => (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{c.email ?? "—"}</span>
        ),
        sortValue: (c) => c.email ?? "",
        sortable: true,
      },
      {
        id: "status",
        header: "Statut",
        accessor: (c) =>
          c.archivedAt ? <StatusPill status="cancelled" size="sm" label="Archivé" /> : null,
        width: 100,
      },
      {
        id: "createdAt",
        header: "Créé le",
        accessor: (c) =>
          new Date(c.createdAt).toLocaleDateString(fr.format.dateLocale, {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }),
        sortValue: (c) => c.createdAt,
        sortable: true,
        width: 120,
      },
      {
        id: "actions",
        header: "",
        accessor: (c) => (
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            {c.archivedAt ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  void restoreClient(c.id);
                }}
              >
                Restaurer
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedClient(c);
                  setFormOpen(true);
                }}
              >
                {fr.clients.actions.edit}
              </Button>
            )}
          </div>
        ),
        width: 120,
        align: "right",
      },
    ],
    [restoreClient]
  );

  return (
    <div
      style={{ padding: "var(--s-6)", display: "flex", flexDirection: "column", gap: "var(--s-5)" }}
    >
      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1
          style={{
            font: "var(--w-black) var(--t-2xl)/1 var(--font-ui)",
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            color: "var(--ink)",
            margin: 0,
          }}
        >
          {fr.clients.title}
        </h1>
        <Button variant="primary" onClick={handleNewClient}>
          {fr.clients.new}
        </Button>
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <input
          className="fakt-input"
          placeholder="Rechercher un client…"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          style={{ flex: 1, maxWidth: 360 }}
          aria-label="Recherche client"
        />
        <Chip
          tone={showArchived ? "accent" : "neutral"}
          onClick={() => setShowArchived((v) => !v)}
          style={{ cursor: "pointer", userSelect: "none" }}
        >
          Afficher la corbeille
        </Chip>
      </div>

      {/* Table */}
      {clients.length === 0 ? (
        <div
          style={{
            border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
            padding: tokens.spacing[7],
            textAlign: "center",
            background: tokens.color.surface,
            boxShadow: tokens.shadow.sm,
            fontFamily: tokens.font.ui,
            color: tokens.color.muted,
          }}
        >
          {fr.clients.empty}
        </div>
      ) : (
        <div
          style={{
            border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
            background: tokens.color.surface,
            boxShadow: tokens.shadow.sm,
          }}
        >
          <Table<Client>
            rows={clients}
            columns={columns}
            getRowId={(c) => c.id}
            onRowClick={handleRowClick}
            filterText=""
            empty={fr.clients.empty}
            rowsPerPage={50}
          />
        </div>
      )}

      {/* Modaux */}
      <ClientForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        initial={selectedClient}
      />

      <ClientDetail
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        client={selectedClient}
        quotes={selectedQuotes}
        invoices={selectedInvoices}
        onEdit={handleEditFromDetail}
        onDelete={handleDeleteFromDetail}
      />
    </div>
  );
}
