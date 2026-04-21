import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { tokens } from "@fakt/design-tokens";
import { Button, Input, StatusPill, Table } from "@fakt/ui";
import type { TableColumn, StatusKind } from "@fakt/ui";
import { fr, formatEur, formatFrDate } from "@fakt/shared";
import type { Quote, QuoteStatus, UUID } from "@fakt/shared";
import { useClientsList, useQuotes } from "./hooks.js";

type StatusFilter = QuoteStatus | "all";

const STATUS_FILTERS: ReadonlyArray<{ id: StatusFilter; label: string }> = [
  { id: "all", label: fr.quotes.statusFilters.all },
  { id: "draft", label: fr.quotes.statusFilters.draft },
  { id: "sent", label: fr.quotes.statusFilters.sent },
  { id: "viewed", label: fr.quotes.statusFilters.viewed },
  { id: "signed", label: fr.quotes.statusFilters.signed },
  { id: "refused", label: fr.quotes.statusFilters.refused },
  { id: "expired", label: fr.quotes.statusFilters.expired },
];

export function QuotesListRoute(): ReactElement {
  const navigate = useNavigate();
  const { quotes, loading } = useQuotes();
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
    return quotes.filter((q) => {
      if (statusFilter !== "all" && q.status !== statusFilter) return false;
      if (clientFilter !== "all" && q.clientId !== clientFilter) return false;
      return true;
    });
  }, [quotes, statusFilter, clientFilter]);

  const columns: ReadonlyArray<TableColumn<Quote>> = useMemo(
    () => [
      {
        id: "number",
        header: fr.quotes.labels.number,
        accessor: (q) => (
          <span
            style={{
              fontFamily: tokens.font.mono,
              fontSize: tokens.fontSize.xs,
              fontVariantNumeric: "tabular-nums",
              color: q.number ? tokens.color.ink : tokens.color.muted,
            }}
          >
            {q.number ?? fr.quotes.labels.numberPending}
          </span>
        ),
        sortable: true,
        sortValue: (q) => q.number ?? "",
        width: 120,
      },
      {
        id: "client",
        header: fr.quotes.labels.client,
        accessor: (q) => clientMap.get(q.clientId) ?? q.clientId,
        sortable: true,
        sortValue: (q) => clientMap.get(q.clientId) ?? "",
        width: 220,
      },
      {
        id: "title",
        header: fr.quotes.labels.title,
        accessor: (q) => (
          <span
            style={{
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.sm,
              color: tokens.color.ink,
            }}
          >
            {q.title}
          </span>
        ),
        sortable: true,
        sortValue: (q) => q.title,
      },
      {
        id: "total",
        header: fr.quotes.labels.totalTtc,
        accessor: (q) => (
          <span
            style={{
              fontFamily: tokens.font.mono,
              fontVariantNumeric: "tabular-nums",
              fontWeight: Number(tokens.fontWeight.bold),
            }}
          >
            {formatEur(q.totalHtCents)}
          </span>
        ),
        align: "right",
        sortable: true,
        sortValue: (q) => q.totalHtCents,
        width: 140,
      },
      {
        id: "status",
        header: fr.quotes.labels.status,
        accessor: (q) => <StatusPill status={q.status as StatusKind} size="sm" />,
        sortable: true,
        sortValue: (q) => q.status,
        width: 120,
      },
      {
        id: "createdAt",
        header: fr.quotes.labels.createdAt,
        accessor: (q) => (
          <span
            style={{
              fontFamily: tokens.font.mono,
              fontSize: tokens.fontSize.xs,
              color: tokens.color.muted,
            }}
          >
            {formatFrDate(q.createdAt)}
          </span>
        ),
        sortable: true,
        sortValue: (q) => new Date(q.createdAt),
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
            {fr.quotes.title}
          </h1>
          <p
            style={{
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.sm,
              color: tokens.color.muted,
              marginTop: tokens.spacing[1],
              marginBottom: 0,
            }}
            data-testid="quotes-count"
          >
            {quotes.length} {quotes.length > 1 ? "devis" : "devis"} ·{" "}
            {formatEur(quotes.reduce((s, q) => s + q.totalHtCents, 0))}
          </p>
        </div>

        <div style={{ position: "relative" }}>
          <Button
            variant="primary"
            onClick={() => setMenuOpen((v) => !v)}
            data-testid="new-quote-menu"
          >
            {fr.quotes.new}
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
                minWidth: 200,
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
                  void navigate("/quotes/new?mode=manual");
                }}
                data-testid="new-quote-manual"
                className="fakt-btn fakt-btn--ghost"
                style={{ justifyContent: "flex-start", height: 40 }}
              >
                {fr.quotes.newMenu.manual}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  void navigate("/quotes/new?mode=ai");
                }}
                data-testid="new-quote-ai"
                className="fakt-btn fakt-btn--ghost"
                style={{ justifyContent: "flex-start", height: 40 }}
              >
                {fr.quotes.newMenu.ai}
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
            placeholder={fr.quotes.search.placeholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="quotes-search"
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
                data-testid={`status-filter-${f.id}`}
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
            data-testid="client-filter"
            style={{ maxWidth: 200 }}
          >
            <option value="all">{fr.quotes.statusFilters.all}</option>
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
      ) : quotes.length === 0 ? (
        <div
          data-testid="quotes-empty"
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
          {fr.quotes.empty}
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
            getRowId={(q) => q.id}
            onRowClick={(q) => void navigate(`/quotes/${q.id}`)}
            filterText={search}
            empty={fr.quotes.empty}
          />
        </div>
      )}
    </div>
  );
}
