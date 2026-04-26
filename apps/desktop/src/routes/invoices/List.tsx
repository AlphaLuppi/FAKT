import { tokens } from "@fakt/design-tokens";
import { formatEur, formatFrDate, fr, today } from "@fakt/shared";
import type { Invoice, InvoiceStatus, UUID } from "@fakt/shared";
import { Button, Input, StatusPill, Table } from "@fakt/ui";
import type { StatusKind, TableColumn } from "@fakt/ui";
import type { ReactElement } from "react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useClientsList } from "../quotes/hooks.js";
import { useInvoices } from "./hooks.js";

type StatusFilter = InvoiceStatus | "overdue" | "all";

const STATUS_CHIP_FILTERS: ReadonlyArray<{ id: StatusFilter; label: string }> = [
  { id: "all", label: fr.invoices.statusFilters.all },
  { id: "draft", label: fr.invoices.statusFilters.draft },
  { id: "sent", label: fr.invoices.statusFilters.sent },
  { id: "paid", label: fr.invoices.statusFilters.paid },
  { id: "overdue", label: fr.invoices.statusFilters.overdue },
  { id: "cancelled", label: fr.invoices.statusFilters.cancelled },
];

export function InvoicesListRoute(): ReactElement {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { invoices, loading } = useInvoices();
  const { clients } = useClientsList();
  const [menuOpen, setMenuOpen] = useState(false);

  const statusFilter = (searchParams.get("status") ?? "all") as StatusFilter;
  const clientFilter = (searchParams.get("client") ?? "all") as UUID | "all";
  const fromFilter = searchParams.get("from") ?? "";
  const toFilter = searchParams.get("to") ?? "";
  const search = searchParams.get("q") ?? "";
  const overdueParam = searchParams.get("overdue") === "true";

  const effectiveStatusFilter: StatusFilter = overdueParam ? "overdue" : statusFilter;

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

  const now = today();

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const isOverdue = inv.status === "sent" && inv.dueDate !== null && inv.dueDate < now;

      if (effectiveStatusFilter === "overdue") {
        if (!isOverdue) return false;
      } else if (effectiveStatusFilter !== "all") {
        if (inv.status !== effectiveStatusFilter) return false;
      }

      if (clientFilter !== "all" && inv.clientId !== clientFilter) return false;

      if (fromFilter) {
        const from = new Date(fromFilter).getTime();
        if ((inv.issuedAt ?? inv.createdAt) < from) return false;
      }
      if (toFilter) {
        const to = new Date(toFilter).getTime() + 86400000;
        if ((inv.issuedAt ?? inv.createdAt) > to) return false;
      }

      if (search) {
        const s = search.toLowerCase();
        const num = (inv.number ?? "").toLowerCase();
        const title = inv.title.toLowerCase();
        const clientName = (clientMap.get(inv.clientId) ?? "").toLowerCase();
        if (!num.includes(s) && !title.includes(s) && !clientName.includes(s)) return false;
      }

      return true;
    });
  }, [invoices, effectiveStatusFilter, clientFilter, fromFilter, toFilter, search, clientMap, now]);

  const columns: ReadonlyArray<TableColumn<Invoice>> = useMemo(
    () => [
      {
        id: "number",
        header: fr.invoices.labels.number,
        accessor: (inv) => (
          <span
            data-testid={`invoice-list-row-${inv.id}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: tokens.spacing[1],
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontFamily: tokens.font.mono,
                fontSize: tokens.fontSize.xs,
                fontVariantNumeric: "tabular-nums",
                color: inv.number || inv.externalNumber ? tokens.color.ink : tokens.color.muted,
              }}
            >
              {inv.number ?? inv.externalNumber ?? fr.invoices.labels.numberPending}
            </span>
            {inv.importedAt !== null && (
              <span
                data-testid={`invoice-imported-badge-${inv.id}`}
                style={{
                  fontFamily: tokens.font.ui,
                  fontSize: 9,
                  fontWeight: Number(tokens.fontWeight.bold),
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  padding: "1px 4px",
                  border: `${tokens.stroke.hair} solid ${tokens.color.ink}`,
                  background: tokens.color.accentSoft,
                  color: tokens.color.ink,
                }}
              >
                {fr.imports.badge}
              </span>
            )}
          </span>
        ),
        sortable: true,
        sortValue: (inv) => inv.number ?? inv.externalNumber ?? "",
        width: 160,
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
        accessor: (inv) => {
          const isOverdue = inv.status === "sent" && inv.dueDate !== null && inv.dueDate < now;
          const displayStatus: StatusKind = isOverdue ? "overdue" : (inv.status as StatusKind);
          return (
            <span data-testid={`invoice-list-row-${inv.id}-status`}>
              <StatusPill status={displayStatus} size="sm" />
            </span>
          );
        },
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
    [clientMap, now]
  );

  const hasActiveFilters =
    effectiveStatusFilter !== "all" ||
    clientFilter !== "all" ||
    fromFilter !== "" ||
    toFilter !== "" ||
    search !== "" ||
    overdueParam;

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
            {invoices.length} {invoices.length > 1 ? "factures" : "facture"} ·{" "}
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
                style={{ justifyContent: "flex-start", height: 40, paddingInline: 16 }}
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
                style={{ justifyContent: "flex-start", height: 40, paddingInline: 16 }}
              >
                {fr.invoices.newMenu.fromScratch}
              </button>
              <div
                style={{
                  height: 1,
                  background: tokens.color.ink,
                  opacity: 0.15,
                }}
              />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  void navigate("/imports?type=invoice");
                }}
                data-testid="new-invoice-import"
                className="fakt-btn fakt-btn--ghost"
                style={{ justifyContent: "flex-start", height: 40, paddingInline: 16 }}
              >
                {fr.imports.listTriggerLabel}
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
            const active = effectiveStatusFilter === f.id || (f.id === "overdue" && overdueParam);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  if (f.id === "overdue") {
                    setSearchParams((prev) => {
                      const next = new URLSearchParams(prev);
                      if (overdueParam) {
                        next.delete("overdue");
                      } else {
                        next.set("overdue", "true");
                        next.delete("status");
                      }
                      return next;
                    });
                  } else {
                    setFilter("status", f.id);
                    setSearchParams((prev) => {
                      const next = new URLSearchParams(prev);
                      next.delete("overdue");
                      if (!f.id || f.id === "all") {
                        next.delete("status");
                      } else {
                        next.set("status", f.id);
                      }
                      return next;
                    });
                  }
                }}
                data-testid={`invoice-status-filter-${f.id}`}
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

        {/* Second row */}
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
              placeholder={fr.invoices.search.placeholder}
              value={search}
              onChange={(e) => setFilter("q", e.target.value)}
              data-testid="invoices-search"
            />
          </div>

          {clients.length > 0 && (
            <select
              className="fakt-input"
              value={clientFilter}
              onChange={(e) => setFilter("client", e.target.value)}
              data-testid="invoice-client-filter"
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
              data-testid="invoice-date-from-filter"
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
              data-testid="invoice-date-to-filter"
              className="fakt-input"
              style={{ width: 140 }}
            />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => setSearchParams({})}
              data-testid="invoice-clear-filters"
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
            filterText=""
            empty={fr.invoices.empty}
          />
        </div>
      )}
    </div>
  );
}
