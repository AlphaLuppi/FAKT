import { tokens } from "@fakt/design-tokens";
import { formatEur, formatFrDate, fr } from "@fakt/shared";
import type { Quote, QuoteStatus, UUID } from "@fakt/shared";
import { Button, Input, StatusPill, Table } from "@fakt/ui";
import type { StatusKind, TableColumn } from "@fakt/ui";
import type { ReactElement } from "react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { quotesApi } from "../../features/doc-editor/quotes-api.js";
import { useClientsList, useQuotes } from "./hooks.js";

type StatusFilter = QuoteStatus | "all";

const STATUS_CHIP_FILTERS: ReadonlyArray<{ id: StatusFilter; label: string }> = [
  { id: "all", label: fr.quotes.statusFilters.all },
  { id: "draft", label: fr.quotes.statusFilters.draft },
  { id: "sent", label: fr.quotes.statusFilters.sent },
  { id: "signed", label: fr.quotes.statusFilters.signed },
  { id: "invoiced", label: fr.quotes.statusFilters.invoiced },
  { id: "refused", label: fr.quotes.statusFilters.refused },
  { id: "expired", label: fr.quotes.statusFilters.expired },
];

export function QuotesListRoute(): ReactElement {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { quotes, loading, refresh } = useQuotes();
  const { clients } = useClientsList();
  const [menuOpen, setMenuOpen] = useState(false);

  const statusFilter = (searchParams.get("status") ?? "all") as StatusFilter;
  const clientFilter = (searchParams.get("client") ?? "all") as UUID | "all";
  const fromFilter = searchParams.get("from") ?? "";
  const toFilter = searchParams.get("to") ?? "";
  const search = searchParams.get("q") ?? "";

  const setFilter = useCallback(
    (key: string, value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (!value || value === "all") {
          next.delete(key);
        } else {
          next.set(key, value);
        }
        return next;
      });
    },
    [setSearchParams]
  );

  const clientMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clients) m.set(c.id, c.name);
    return m;
  }, [clients]);

  const filtered = useMemo(() => {
    const now = Date.now();
    return quotes.filter((q) => {
      if (statusFilter !== "all" && q.status !== statusFilter) return false;
      if (clientFilter !== "all" && q.clientId !== clientFilter) return false;
      if (fromFilter) {
        const from = new Date(fromFilter).getTime();
        if (q.createdAt < from) return false;
      }
      if (toFilter) {
        const to = new Date(toFilter).getTime() + 86400000;
        if (q.createdAt > to) return false;
      }
      if (search) {
        const s = search.toLowerCase();
        const num = (q.number ?? "").toLowerCase();
        const notes = (q.notes ?? "").toLowerCase();
        const title = q.title.toLowerCase();
        const clientName = (clientMap.get(q.clientId) ?? "").toLowerCase();
        if (!num.includes(s) && !notes.includes(s) && !title.includes(s) && !clientName.includes(s))
          return false;
      }
      void now;
      return true;
    });
  }, [quotes, statusFilter, clientFilter, fromFilter, toFilter, search, clientMap]);

  async function handleDuplicate(q: Quote): Promise<void> {
    try {
      await quotesApi.create({
        clientId: q.clientId,
        title: `${q.title} (copie)`,
        conditions: q.conditions,
        validityDate: q.validityDate,
        notes: q.notes,
        totalHtCents: q.totalHtCents,
        items: q.items.map((it) => ({
          id: it.id,
          position: it.position,
          description: it.description,
          quantity: it.quantity,
          unitPriceCents: it.unitPriceCents,
          unit: it.unit,
          lineTotalCents: it.lineTotalCents,
          serviceId: it.serviceId,
        })),
        issueNumber: false,
      });
      refresh();
    } catch {
      // silently ignore
    }
  }

  const columns: ReadonlyArray<TableColumn<Quote>> = useMemo(
    () => [
      {
        id: "number",
        header: fr.quotes.labels.number,
        accessor: (q) => (
          <span
            data-testid={`quote-list-row-${q.id}`}
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
        accessor: (q) => (
          <span data-testid={`quote-list-row-${q.id}-status`}>
            <StatusPill status={q.status as StatusKind} size="sm" />
          </span>
        ),
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
      {
        id: "actions",
        header: fr.quotes.labels.actions,
        accessor: (q) => (
          <div
            style={{ display: "flex", gap: tokens.spacing[1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {(q.status === "draft" || q.status === "sent") && (
              <ActionChip
                label={fr.quotes.actions.sign}
                onClick={() => void navigate(`/quotes/${q.id}`)}
                testId={`quote-list-sign-${q.id}`}
              />
            )}
            <ActionChip
              label={fr.quotes.actions.duplicate}
              onClick={() => void handleDuplicate(q)}
              testId={`quote-list-duplicate-${q.id}`}
            />
          </div>
        ),
        width: 160,
      },
    ],
    [clientMap, navigate]
  );

  const hasActiveFilters =
    statusFilter !== "all" || clientFilter !== "all" || fromFilter || toFilter || search;

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
            {quotes.length} devis · {formatEur(quotes.reduce((s, q) => s + q.totalHtCents, 0))}
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
                style={{ justifyContent: "flex-start", height: 40, paddingInline: 16 }}
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
                style={{ justifyContent: "flex-start", height: 40, paddingInline: 16 }}
              >
                {fr.quotes.newMenu.ai}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Filters */}
      <section
        aria-label="filtres"
        style={{ display: "flex", flexDirection: "column", gap: tokens.spacing[3] }}
      >
        {/* Status chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: tokens.spacing[2] }}>
          {STATUS_CHIP_FILTERS.map((f) => {
            const active = statusFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter("status", f.id)}
                data-testid={`status-filter-${f.id}`}
                aria-pressed={active}
                style={{
                  padding: "6px 12px",
                  border: `1.5px solid ${tokens.color.ink}`,
                  background: active ? tokens.color.accentSoft : tokens.color.surface,
                  color: tokens.color.ink,
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

        {/* Second row: search + client + dates + clear */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: tokens.spacing[3],
          }}
        >
          <div style={{ flex: "1 1 200px", minWidth: 180 }}>
            <Input
              type="search"
              placeholder={fr.quotes.search.placeholder}
              value={search}
              onChange={(e) => setFilter("q", e.target.value)}
              data-testid="quotes-search"
            />
          </div>

          {clients.length > 0 && (
            <select
              className="fakt-input"
              value={clientFilter}
              onChange={(e) => setFilter("client", e.target.value)}
              data-testid="client-filter"
              style={{ maxWidth: 200 }}
            >
              <option value="all">{fr.filters.clientPlaceholder}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: tokens.spacing[2] }}>
            <label
              style={{
                fontFamily: tokens.font.ui,
                fontSize: tokens.fontSize.xs,
                fontWeight: Number(tokens.fontWeight.bold),
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: tokens.color.muted,
              }}
            >
              {fr.filters.dateFromLabel}
            </label>
            <input
              type="date"
              value={fromFilter}
              onChange={(e) => setFilter("from", e.target.value)}
              data-testid="date-from-filter"
              className="fakt-input"
              style={{ width: 140 }}
            />
            <label
              style={{
                fontFamily: tokens.font.ui,
                fontSize: tokens.fontSize.xs,
                fontWeight: Number(tokens.fontWeight.bold),
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: tokens.color.muted,
              }}
            >
              {fr.filters.dateToLabel}
            </label>
            <input
              type="date"
              value={toFilter}
              onChange={(e) => setFilter("to", e.target.value)}
              data-testid="date-to-filter"
              className="fakt-input"
              style={{ width: 140 }}
            />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => setSearchParams({})}
              data-testid="clear-filters"
              style={{
                padding: "6px 12px",
                border: `1.5px solid ${tokens.color.ink}`,
                background: "transparent",
                fontFamily: tokens.font.ui,
                fontSize: tokens.fontSize.xs,
                fontWeight: Number(tokens.fontWeight.bold),
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: tokens.color.muted,
                cursor: "pointer",
              }}
            >
              {fr.filters.clearAll}
            </button>
          )}
        </div>
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
            filterText=""
            empty={fr.quotes.empty}
          />
        </div>
      )}
    </div>
  );
}

function ActionChip({
  label,
  onClick,
  testId,
}: { label: string; onClick: () => void; testId: string }): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      style={{
        padding: "3px 8px",
        border: `1.5px solid ${tokens.color.ink}`,
        background: tokens.color.surface,
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
