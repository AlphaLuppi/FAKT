import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { tokens } from "@fakt/design-tokens";
import { Button, Input, StatusPill, Table } from "@fakt/ui";
import type { TableColumn, StatusKind } from "@fakt/ui";
import { fr, formatEur, formatFrDate } from "@fakt/shared";
import type { Invoice, InvoiceStatus, UUID } from "@fakt/shared";
import { useInvoices } from "./hooks.js";
import { useClientsList } from "../quotes/hooks.js";

type StatusFilter = InvoiceStatus | "all";

const STATUS_FILTERS: ReadonlyArray<{ id: StatusFilter; label: string }> = [
  { id: "all", label: fr.invoices.statusFilters.all },
  { id: "draft", label: fr.invoices.statusFilters.draft },
  { id: "sent", label: fr.invoices.statusFilters.sent },
  { id: "paid", label: fr.invoices.statusFilters.paid },
  { id: "overdue", label: fr.invoices.statusFilters.overdue },
  { id: "cancelled", label: fr.invoices.statusFilters.cancelled },
];

export function InvoicesListRoute(): ReactElement {
  const navigate = useNavigate();
  const { invoices, loading } = useInvoices();
  const { clients } = useClientsList();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [clientFilter, setClientFilter] = useState<UUID | "all">("all");
  const [menuOpen, setMenuOpen] = useState(false);

  const clientMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clients) m.set(c.id, c.name);
    return m;
  }, [clients]);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== "all" && inv.status !== statusFilter) return false;
      if (clientFilter !== "all" && inv.clientId !== clientFilter) return false;
      return true;
    });
  }, [invoices, statusFilter, clientFilter]);

  const columns: ReadonlyArray<TableColumn<Invoice>> = useMemo(
    () => [
      {
        id: "number",
        header: fr.invoices.labels.number,
        accessor: (inv) => (
          <span
            style={{
              fontFamily: tokens.font.mono,
              fontSize: tokens.fontSize.xs,
              fontVariantNumeric: "tabular-nums",
              color: inv.number ? tokens.color.ink : tokens.color.muted,
            }}
          >
            {inv.number ?? fr.invoices.labels.numberPending}
          </span>
        ),
        sortable: true,
        sortValue: (inv) => inv.number ?? "",
        width: 120,
      },
      {
        id: "client",
        header: fr.invoices.labels.client,
        accessor: (inv) => clientMap.get(inv.clientId) ?? inv.clientId,
        sortable: true,
        sortValue: (inv) => clientMap.get(inv.clientId) ?? "",
        width: 220,
      },
      {
        id: "title",
        header: fr.invoices.labels.title,
        accessor: (inv) => (
          <span
            style={{
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.sm,
              color: tokens.color.ink,
            }}
          >
            {inv.title}
          </span>
        ),
        sortable: true,
        sortValue: (inv) => inv.title,
      },
      {
        id: "total",
        header: fr.invoices.labels.totalTtc,
        accessor: (inv) => (
          <span
            style={{
              fontFamily: tokens.font.mono,
              fontVariantNumeric: "tabular-nums",
              fontWeight: Number(tokens.fontWeight.bold),
            }}
          >
            {formatEur(inv.totalHtCents)}
          </span>
        ),
        align: "right",
        sortable: true,
        sortValue: (inv) => inv.totalHtCents,
        width: 140,
      },
      {
        id: "status",
        header: fr.invoices.labels.status,
        accessor: (inv) => <StatusPill status={inv.status as StatusKind} size="sm" />,
        sortable: true,
        sortValue: (inv) => inv.status,
        width: 120,
      },
      {
        id: "issuedAt",
        header: fr.invoices.labels.issuedAt,
        accessor: (inv) => (
          <span
            style={{
              fontFamily: tokens.font.mono,
              fontSize: tokens.fontSize.xs,
              color: tokens.color.muted,
            }}
          >
            {inv.issuedAt ? formatFrDate(inv.issuedAt) : "—"}
          </span>
        ),
        sortable: true,
        sortValue: (inv) => (inv.issuedAt ? new Date(inv.issuedAt) : new Date(0)),
        width: 120,
      },
    ],
    [clientMap],
  );

  return (
    <div
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
            {fr.invoices.title}
          </h1>
          <p
            style={{
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.sm,
              color: tokens.color.muted,
              marginTop: tokens.spacing[1],
              marginBottom: 0,
            }}
            data-testid="invoices-count"
          >
            {invoices.length}{" "}
            {invoices.length > 1 ? "factures" : "facture"} ·{" "}
            {formatEur(invoices.reduce((s, inv) => s + inv.totalHtCents, 0))}
          </p>
        </div>

        <div style={{ position: "relative" }}>
          <Button
            variant="primary"
            onClick={() => setMenuOpen((v) => !v)}
            data-testid="new-invoice-menu"
          >
            {fr.invoices.new}
          </Button>
          {menuOpen && (
            <div
              role="menu"
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                right: 0,
                border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
                background: tokens.color.surface,
                boxShadow: tokens.shadow.sm,
                minWidth: 220,
                zIndex: 10,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  void navigate("/invoices/new?from=quote");
                }}
                data-testid="new-invoice-from-quote"
                className="fakt-btn fakt-btn--ghost"
                style={{ justifyContent: "flex-start", height: 40 }}
              >
                {fr.invoices.newMenu.fromQuote}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  void navigate("/invoices/new?from=scratch");
                }}
                data-testid="new-invoice-from-scratch"
                className="fakt-btn fakt-btn--ghost"
                style={{ justifyContent: "flex-start", height: 40 }}
              >
                {fr.invoices.newMenu.fromScratch}
              </button>
            </div>
          )}
        </div>
      </header>

      <section
        aria-label="filtres"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: tokens.spacing[3],
        }}
      >
        <div style={{ flex: "1 1 240px", minWidth: 200 }}>
          <Input
            type="search"
            placeholder={fr.invoices.search.placeholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="invoices-search"
          />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: tokens.spacing[2] }}>
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                data-testid={`invoice-status-filter-${f.id}`}
                aria-pressed={active}
                style={{
                  padding: "6px 12px",
                  border: `1.5px solid ${tokens.color.ink}`,
                  background: active ? tokens.color.ink : tokens.color.surface,
                  color: active ? tokens.color.accentSoft : tokens.color.ink,
                  fontFamily: tokens.font.ui,
                  fontSize: tokens.fontSize.xs,
                  fontWeight: Number(tokens.fontWeight.bold),
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  cursor: "pointer",
                  boxShadow: active ? "none" : tokens.shadow.sm,
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        {clients.length > 0 && (
          <select
            className="fakt-input"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value as UUID | "all")}
            data-testid="invoice-client-filter"
            style={{ maxWidth: 200 }}
          >
            <option value="all">{fr.invoices.statusFilters.all}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </section>

      {loading ? (
        <div
          style={{
            fontFamily: tokens.font.ui,
            color: tokens.color.muted,
            padding: tokens.spacing[5],
          }}
        >
          Chargement…
        </div>
      ) : invoices.length === 0 ? (
        <div
          data-testid="invoices-empty"
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
          {fr.invoices.empty}
        </div>
      ) : (
        <div
          style={{
            border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
            background: tokens.color.surface,
            boxShadow: tokens.shadow.sm,
          }}
        >
          <Table
            rows={filtered}
            columns={columns}
            getRowId={(inv) => inv.id}
            onRowClick={(inv) => void navigate(`/invoices/${inv.id}`)}
            filterText={search}
            empty={fr.invoices.empty}
          />
        </div>
      )}
    </div>
  );
}
