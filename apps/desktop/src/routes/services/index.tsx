import { tokens } from "@fakt/design-tokens";
import { fr } from "@fakt/shared";
import type { DocumentUnit, Service } from "@fakt/shared";
import { Button, Chip, StatusPill, Table } from "@fakt/ui";
import type { TableColumn } from "@fakt/ui";
import type { ReactElement } from "react";
import { useCallback, useMemo, useState } from "react";
import { usePrestations } from "../../hooks/usePrestations.js";
import { PrestationForm } from "./PrestationForm.js";
import type { PrestationFormValues } from "./PrestationForm.js";

function formatPrice(cents: number): string {
  return new Intl.NumberFormat(fr.format.currencyLocale, {
    style: "currency",
    currency: fr.format.currency,
  }).format(cents / 100);
}

export function ServicesRoute(): ReactElement {
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedPrestation, setSelectedPrestation] = useState<Service | null>(null);

  const { prestations, createPrestation, updatePrestation, deletePrestation, restorePrestation } =
    usePrestations({ search, includeSoftDeleted: showArchived });

  const handleNew = (): void => {
    setSelectedPrestation(null);
    setFormOpen(true);
  };

  const handleRowClick = (p: Service): void => {
    setSelectedPrestation(p);
    setFormOpen(true);
  };

  const handleFormSubmit = useCallback(
    async (values: PrestationFormValues): Promise<void> => {
      if (selectedPrestation) {
        await updatePrestation(selectedPrestation.id, {
          name: values.name,
          description: values.description ?? null,
          unit: values.unit as DocumentUnit,
          unitPriceCents: values.unitPriceCents,
          tags: values.tags ?? null,
        });
      } else {
        await createPrestation({
          name: values.name,
          description: values.description ?? null,
          unit: values.unit as DocumentUnit,
          unitPriceCents: values.unitPriceCents,
          tags: values.tags ?? null,
        });
      }
    },
    [selectedPrestation, createPrestation, updatePrestation]
  );

  const columns = useMemo(
    (): TableColumn<Service>[] => [
      {
        id: "name",
        header: fr.services.labels.name,
        accessor: (s) => <span style={{ fontWeight: 700, color: "var(--ink)" }}>{s.name}</span>,
        sortValue: (s) => s.name,
        sortable: true,
      },
      {
        id: "description",
        header: fr.services.labels.description,
        accessor: (s) => (
          <span
            style={{
              color: "var(--muted)",
              fontSize: 12,
              maxWidth: 280,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "block",
            }}
          >
            {s.description ?? "—"}
          </span>
        ),
      },
      {
        id: "unit",
        header: fr.services.labels.unit,
        accessor: (s) => fr.services.units[s.unit as keyof typeof fr.services.units] ?? s.unit,
        sortValue: (s) => s.unit,
        sortable: true,
        width: 100,
      },
      {
        id: "unitPriceCents",
        header: fr.services.labels.unitPrice,
        accessor: (s) => (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
            {formatPrice(s.unitPriceCents)}
          </span>
        ),
        sortValue: (s) => s.unitPriceCents,
        sortable: true,
        align: "right",
        width: 130,
      },
      {
        id: "tags",
        header: fr.services.labels.tags,
        accessor: (s) =>
          s.tags && s.tags.length > 0 ? (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {s.tags.slice(0, 3).map((tag) => (
                <Chip key={tag} tone="neutral" style={{ fontSize: 10 }}>
                  {tag}
                </Chip>
              ))}
              {s.tags.length > 3 && (
                <Chip tone="neutral" style={{ fontSize: 10 }}>
                  +{s.tags.length - 3}
                </Chip>
              )}
            </div>
          ) : null,
        width: 180,
      },
      {
        id: "status",
        header: "Statut",
        accessor: (s) =>
          s.archivedAt ? <StatusPill status="cancelled" size="sm" label="Archivé" /> : null,
        width: 90,
      },
      {
        id: "actions",
        header: "",
        accessor: (s) => (
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            {s.archivedAt ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  void restorePrestation(s.id);
                }}
              >
                Restaurer
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPrestation(s);
                    setFormOpen(true);
                  }}
                >
                  Modifier
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    void deletePrestation(s.id);
                  }}
                >
                  Archiver
                </Button>
              </>
            )}
          </div>
        ),
        width: 180,
        align: "right",
      },
    ],
    [restorePrestation, deletePrestation]
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
          {fr.services.title}
        </h1>
        <Button variant="primary" onClick={handleNew}>
          {fr.services.new}
        </Button>
      </div>

      {/* Filtres */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <input
          className="fakt-input"
          placeholder="Rechercher une prestation…"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          style={{ flex: 1, maxWidth: 360 }}
          aria-label="Recherche prestation"
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
      {prestations.length === 0 ? (
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
          {fr.services.empty}
        </div>
      ) : (
        <div
          style={{
            border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
            background: tokens.color.surface,
            boxShadow: tokens.shadow.sm,
          }}
        >
          <Table<Service>
            rows={prestations}
            columns={columns}
            getRowId={(s) => s.id}
            onRowClick={handleRowClick}
            filterText=""
            empty={fr.services.empty}
            rowsPerPage={50}
          />
        </div>
      )}

      {/* Modal formulaire */}
      <PrestationForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        initial={selectedPrestation}
      />
    </div>
  );
}
