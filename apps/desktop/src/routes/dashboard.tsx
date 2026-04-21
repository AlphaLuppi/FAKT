import type { ReactElement } from "react";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { tokens } from "@fakt/design-tokens";
import { StatusPill, Sparkline } from "@fakt/ui";
import type { StatusKind } from "@fakt/ui";
import {
  fr,
  formatEur,
  formatFrDate,
  today,
} from "@fakt/shared";
import type { Invoice, Quote } from "@fakt/shared";
import { useQuotes } from "./quotes/hooks.js";
import { useInvoices } from "./invoices/hooks.js";
import { useComposerSidebar } from "../components/composer-sidebar/ComposerContext.js";

type ActivityKind =
  | "quote-created"
  | "quote-sent"
  | "quote-signed"
  | "quote-invoiced"
  | "invoice-created"
  | "invoice-sent"
  | "invoice-paid";

interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  at: number;
  label: string;
  reference: string;
  clientId: string;
  docPath: string;
}

function buildQuoteActivity(q: Quote): ActivityEntry {
  const reference = q.number ?? q.id.slice(0, 8);
  const docPath = `/quotes/${q.id}`;
  if (q.status === "invoiced") {
    return { id: `q-${q.id}-inv`, kind: "quote-invoiced", at: q.updatedAt, label: fr.dashboard.activity.quoteInvoiced, reference, clientId: q.clientId, docPath };
  }
  if (q.status === "signed" && q.signedAt) {
    return { id: `q-${q.id}-signed`, kind: "quote-signed", at: q.signedAt, label: fr.dashboard.activity.quoteSigned, reference, clientId: q.clientId, docPath };
  }
  if (q.status === "sent" && q.issuedAt) {
    return { id: `q-${q.id}-sent`, kind: "quote-sent", at: q.issuedAt, label: fr.dashboard.activity.quoteSent, reference, clientId: q.clientId, docPath };
  }
  return { id: `q-${q.id}-created`, kind: "quote-created", at: q.createdAt, label: fr.dashboard.activity.quoteCreated, reference, clientId: q.clientId, docPath };
}

function buildInvoiceActivity(inv: Invoice): ActivityEntry {
  const reference = inv.number ?? inv.id.slice(0, 8);
  const docPath = `/invoices/${inv.id}`;
  if (inv.status === "paid" && inv.paidAt) {
    return { id: `i-${inv.id}-paid`, kind: "invoice-paid", at: inv.paidAt, label: fr.dashboard.activity.invoicePaid, reference, clientId: inv.clientId, docPath };
  }
  if (inv.status === "sent" && inv.issuedAt) {
    return { id: `i-${inv.id}-sent`, kind: "invoice-sent", at: inv.issuedAt, label: fr.dashboard.activity.invoiceSent, reference, clientId: inv.clientId, docPath };
  }
  return { id: `i-${inv.id}-created`, kind: "invoice-created", at: inv.createdAt, label: fr.dashboard.activity.invoiceCreated, reference, clientId: inv.clientId, docPath };
}

function buildSparkline(invoices: Invoice[], days: number, kind: "issued" | "paid"): number[] {
  const now = Date.now();
  const points: number[] = Array(days).fill(0);
  for (const inv of invoices) {
    const ts = kind === "paid" ? inv.paidAt : inv.issuedAt;
    if (!ts) continue;
    const daysAgo = Math.floor((now - ts) / (24 * 3600 * 1000));
    if (daysAgo >= 0 && daysAgo < days) {
      const idx = days - 1 - daysAgo;
      const current = points[idx];
      if (current !== undefined) points[idx] = current + inv.totalHtCents;
    }
  }
  return points;
}

function currentMonthRange(): { start: number; end: number } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
  return { start, end };
}

export function DashboardRoute(): ReactElement {
  const navigate = useNavigate();
  const { quotes, loading: quotesLoading } = useQuotes();
  const { invoices, loading: invoicesLoading } = useInvoices();
  const { openWithContext } = useComposerSidebar();

  const loading = quotesLoading || invoicesLoading;
  const now = today();
  const { start: monthStart, end: monthEnd } = useMemo(() => currentMonthRange(), []);

  const caEmis = useMemo(
    () => invoices.filter((inv) => inv.issuedAt !== null && inv.issuedAt >= monthStart && inv.issuedAt <= monthEnd).reduce((s, inv) => s + inv.totalHtCents, 0),
    [invoices, monthStart, monthEnd],
  );

  const caEncaisse = useMemo(
    () => invoices.filter((inv) => inv.status === "paid" && inv.paidAt !== null && inv.paidAt >= monthStart && inv.paidAt <= monthEnd).reduce((s, inv) => s + inv.totalHtCents, 0),
    [invoices, monthStart, monthEnd],
  );

  const pendingQuotes = useMemo(() => quotes.filter((q) => q.status === "sent"), [quotes]);
  const pendingQuotesSum = useMemo(() => pendingQuotes.reduce((s, q) => s + q.totalHtCents, 0), [pendingQuotes]);

  const overdueInvoices = useMemo(
    () => invoices.filter((inv) => inv.status === "sent" && inv.dueDate !== null && inv.dueDate < now),
    [invoices, now],
  );
  const overdueSum = useMemo(() => overdueInvoices.reduce((s, inv) => s + inv.totalHtCents, 0), [overdueInvoices]);

  const sparklineEmis = useMemo(() => buildSparkline(invoices, 30, "issued"), [invoices]);
  const sparklineEncaisse = useMemo(() => buildSparkline(invoices, 30, "paid"), [invoices]);

  const pipelineCounts = useMemo(() => {
    const counts = { draft: 0, sent: 0, signed: 0, invoiced: 0, paid: 0 };
    for (const q of quotes) {
      if (q.status === "draft") counts.draft++;
      else if (q.status === "sent") counts.sent++;
      else if (q.status === "signed") counts.signed++;
      else if (q.status === "invoiced") counts.invoiced++;
    }
    for (const inv of invoices) {
      if (inv.status === "paid") counts.paid++;
    }
    return counts;
  }, [quotes, invoices]);

  const recentActivity = useMemo((): ActivityEntry[] => {
    const entries: ActivityEntry[] = [
      ...quotes.map(buildQuoteActivity),
      ...invoices.map(buildInvoiceActivity),
    ];
    entries.sort((a, b) => b.at - a.at);
    return entries.slice(0, 20);
  }, [quotes, invoices]);

  const overdueSuggestions = useMemo(
    () => overdueInvoices.filter((inv) => {
      if (!inv.dueDate) return false;
      return (now - inv.dueDate) > 7 * 24 * 3600 * 1000;
    }).slice(0, 5),
    [overdueInvoices, now],
  );

  return (
    <div
      style={{
        padding: tokens.spacing[6],
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacing[5],
        minHeight: "calc(100vh - 56px)",
        boxSizing: "border-box",
      }}
      data-testid="dashboard-root"
    >
      <header>
        <h1
          style={{
            font: `var(--w-black) var(--t-2xl)/1 ${tokens.font.ui}`,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            color: tokens.color.ink,
            margin: 0,
          }}
        >
          {fr.dashboard.title}
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
          {fr.dashboard.subtitle}
        </p>
      </header>

      {/* KPIs row */}
      <div
        data-testid="dashboard-kpis"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: tokens.spacing[4],
        }}
      >
        <KpiCard
          testId="kpi-ca-emis"
          title={fr.dashboard.kpi.caEmisTitle}
          hint={fr.dashboard.kpi.caEmisHint}
          value={loading ? null : formatEur(caEmis)}
          sparkline={sparklineEmis}
          onClick={() => void navigate("/invoices")}
        />
        <KpiCard
          testId="kpi-ca-encaisse"
          title={fr.dashboard.kpi.caEncaisseTitle}
          hint={fr.dashboard.kpi.caEncaisseHint}
          value={loading ? null : formatEur(caEncaisse)}
          sparkline={sparklineEncaisse}
          onClick={() => void navigate("/invoices?status=paid")}
        />
        <KpiCard
          testId="kpi-devis-attente"
          title={fr.dashboard.kpi.devisAttenteTitle}
          hint={fr.dashboard.kpi.devisAttenteHint}
          value={loading ? null : String(pendingQuotes.length)}
          subValue={loading ? undefined : formatEur(pendingQuotesSum)}
          onClick={() => void navigate("/quotes?status=sent")}
        />
        <KpiCard
          testId="kpi-factures-retard"
          title={fr.dashboard.kpi.facturesRetardTitle}
          hint={fr.dashboard.kpi.facturesRetardHint}
          value={loading ? null : String(overdueInvoices.length)}
          subValue={loading ? undefined : formatEur(overdueSum)}
          accent="danger"
          onClick={() => void navigate("/invoices?overdue=true")}
        />
      </div>

      {/* Pipeline */}
      <section
        data-testid="dashboard-pipeline"
        style={{
          border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
          background: tokens.color.surface,
          boxShadow: tokens.shadow.sm,
          padding: tokens.spacing[5],
          display: "flex",
          flexDirection: "column",
          gap: tokens.spacing[3],
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
          {fr.dashboard.pipeline.title}
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: tokens.spacing[2] }}>
          {(["draft", "sent", "signed", "invoiced", "paid"] as const).map((stage, idx) => (
            <PipelineStage
              key={stage}
              label={fr.dashboard.pipeline[stage]}
              count={pipelineCounts[stage]}
              isLast={idx === 4}
              onClick={() => {
                if (stage === "paid") void navigate("/invoices?status=paid");
                else void navigate(`/quotes?status=${stage}`);
              }}
            />
          ))}
        </div>
      </section>

      {/* Main grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          gap: tokens.spacing[5],
          alignItems: "start",
        }}
      >
        {/* Activity feed */}
        <section
          data-testid="widget-recent-activity"
          style={{
            border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
            background: tokens.color.surface,
            boxShadow: tokens.shadow.sm,
            padding: tokens.spacing[5],
            display: "flex",
            flexDirection: "column",
            gap: tokens.spacing[3],
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
            {fr.dashboard.widgets.recentActivityTitle}
          </h2>
          {loading ? (
            <LoadingWidget />
          ) : recentActivity.length === 0 ? (
            <EmptyWidget>{fr.dashboard.widgets.recentActivityEmpty}</EmptyWidget>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column" }}>
              {recentActivity.map((entry) => (
                <ActivityRow
                  key={entry.id}
                  entry={entry}
                  onClick={() => void navigate(entry.docPath)}
                />
              ))}
            </ul>
          )}
        </section>

        {/* Suggestions IA */}
        <section
          data-testid="dashboard-suggestions"
          style={{
            border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
            background: tokens.color.surface,
            boxShadow: tokens.shadow.sm,
            padding: tokens.spacing[5],
            display: "flex",
            flexDirection: "column",
            gap: tokens.spacing[3],
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
            {fr.dashboard.suggestions.title}
          </h2>
          {loading ? (
            <LoadingWidget />
          ) : overdueSuggestions.length === 0 ? (
            <EmptyWidget>{fr.dashboard.suggestions.empty}</EmptyWidget>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: tokens.spacing[2] }}>
              {overdueSuggestions.map((inv) => {
                const daysOverdue = inv.dueDate ? Math.floor((now - inv.dueDate) / (24 * 3600 * 1000)) : 0;
                return (
                  <li
                    key={inv.id}
                    style={{
                      border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
                      padding: tokens.spacing[3],
                      display: "flex",
                      flexDirection: "column",
                      gap: tokens.spacing[2],
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <span
                        style={{
                          fontFamily: tokens.font.mono,
                          fontSize: tokens.fontSize.xs,
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: Number(tokens.fontWeight.bold),
                          color: tokens.color.ink,
                        }}
                      >
                        {inv.number ?? inv.id.slice(0, 8)}
                      </span>
                      <span
                        style={{
                          fontFamily: tokens.font.ui,
                          fontSize: tokens.fontSize.xs,
                          color: tokens.color.ink,
                          background: tokens.color.dangerBg,
                          border: `${tokens.stroke.hair} solid ${tokens.color.ink}`,
                          padding: "2px 6px",
                          fontWeight: Number(tokens.fontWeight.bold),
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {fr.dashboard.suggestions.overdueLabel(daysOverdue)}
                      </span>
                    </div>
                    <div
                      style={{
                        fontFamily: tokens.font.mono,
                        fontSize: tokens.fontSize.sm,
                        fontVariantNumeric: "tabular-nums",
                        color: tokens.color.ink,
                      }}
                    >
                      {formatEur(inv.totalHtCents)}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        openWithContext(
                          { docType: "invoice", number: inv.number ?? inv.id.slice(0, 8), clientName: inv.clientId, amountCents: inv.totalHtCents, status: inv.status },
                          fr.dashboard.suggestions.draftRelance,
                        );
                      }}
                      style={{
                        padding: "6px 12px",
                        border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
                        background: tokens.color.ink,
                        color: tokens.color.accentSoft,
                        fontFamily: tokens.font.ui,
                        fontSize: tokens.fontSize.xs,
                        fontWeight: Number(tokens.fontWeight.bold),
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        cursor: "pointer",
                        alignSelf: "flex-start",
                      }}
                    >
                      {fr.dashboard.suggestions.draftRelance}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

interface KpiCardProps {
  testId: string;
  title: string;
  hint: string;
  value: string | null;
  subValue?: string | undefined;
  sparkline?: number[] | undefined;
  accent?: "default" | "danger" | undefined;
  onClick: () => void;
}

function KpiCard({ testId, title, hint, value, subValue, sparkline, accent = "default", onClick }: KpiCardProps): ReactElement {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      style={{
        border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
        background: tokens.color.surface,
        boxShadow: tokens.shadow.sm,
        padding: tokens.spacing[4],
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacing[2],
        cursor: "pointer",
        textAlign: "left",
        transition: "background 80ms, color 80ms",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = tokens.color.ink;
        (e.currentTarget as HTMLButtonElement).style.color = tokens.color.accentSoft;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = tokens.color.surface;
        (e.currentTarget as HTMLButtonElement).style.color = tokens.color.ink;
      }}
    >
      <div
        style={{
          fontFamily: tokens.font.ui,
          fontSize: tokens.fontSize.xs,
          fontWeight: Number(tokens.fontWeight.bold),
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "inherit",
        }}
      >
        {title}
      </div>
      {value !== null && (
        <div
          style={{
            fontFamily: tokens.font.mono,
            fontSize: tokens.fontSize.xl,
            fontWeight: Number(tokens.fontWeight.black),
            fontVariantNumeric: "tabular-nums",
            color: accent === "danger" ? tokens.color.dangerBg : "inherit",
          }}
          data-testid={`${testId}-value`}
        >
          {value}
        </div>
      )}
      {value === null && <LoadingWidget />}
      {subValue && (
        <div
          style={{
            fontFamily: tokens.font.mono,
            fontSize: tokens.fontSize.xs,
            fontVariantNumeric: "tabular-nums",
            color: "inherit",
            opacity: 0.7,
          }}
        >
          {subValue}
        </div>
      )}
      {sparkline && sparkline.length > 0 && (
        <Sparkline
          data={sparkline}
          width={120}
          height={24}
          stroke={tokens.color.ink}
          ariaLabel={hint}
        />
      )}
      <div
        style={{
          fontFamily: tokens.font.ui,
          fontSize: tokens.fontSize.xs,
          color: "inherit",
          opacity: 0.5,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {hint}
      </div>
    </button>
  );
}

function PipelineStage({ label, count, isLast, onClick }: { label: string; count: number; isLast: boolean; onClick: () => void }): ReactElement {
  return (
    <>
      <button
        type="button"
        onClick={onClick}
        style={{
          border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
          background: tokens.color.surface,
          padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: tokens.spacing[1],
          cursor: "pointer",
          flex: 1,
          transition: "background 80ms, color 80ms",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = tokens.color.ink;
          (e.currentTarget as HTMLButtonElement).style.color = tokens.color.accentSoft;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = tokens.color.surface;
          (e.currentTarget as HTMLButtonElement).style.color = tokens.color.ink;
        }}
      >
        <span
          style={{
            fontFamily: tokens.font.mono,
            fontSize: tokens.fontSize.lg,
            fontWeight: Number(tokens.fontWeight.black),
            fontVariantNumeric: "tabular-nums",
            color: "inherit",
          }}
        >
          {count}
        </span>
        <span
          style={{
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.xs,
            fontWeight: Number(tokens.fontWeight.bold),
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "inherit",
          }}
        >
          {label}
        </span>
      </button>
      {!isLast && (
        <span
          style={{
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.lg,
            fontWeight: Number(tokens.fontWeight.bold),
            color: tokens.color.muted,
            flexShrink: 0,
          }}
        >
          →
        </span>
      )}
    </>
  );
}

const ACTIVITY_PILL: Record<ActivityKind, StatusKind> = {
  "quote-created": "draft",
  "quote-sent": "sent",
  "quote-signed": "signed",
  "quote-invoiced": "invoiced",
  "invoice-created": "draft",
  "invoice-sent": "sent",
  "invoice-paid": "paid",
};

function ActivityRow({ entry, onClick }: { entry: ActivityEntry; onClick: () => void }): ReactElement {
  return (
    <li
      data-testid={`activity-row-${entry.id}`}
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto",
        alignItems: "center",
        gap: tokens.spacing[3],
        padding: `${tokens.spacing[2]} 0`,
        borderBottom: `${tokens.stroke.hair} solid ${tokens.color.ink}`,
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLLIElement).style.background = tokens.color.accentSoft;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLLIElement).style.background = "transparent";
      }}
    >
      <span
        style={{
          fontFamily: tokens.font.mono,
          fontSize: tokens.fontSize.xs,
          color: tokens.color.muted,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {formatFrDate(entry.at)}
      </span>
      <span
        style={{
          fontFamily: tokens.font.ui,
          fontSize: tokens.fontSize.sm,
          color: tokens.color.ink,
          fontWeight: Number(tokens.fontWeight.bold),
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {entry.label}
      </span>
      <span
        style={{
          fontFamily: tokens.font.mono,
          fontSize: tokens.fontSize.xs,
          color: tokens.color.ink,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {entry.reference}
      </span>
      <StatusPill status={ACTIVITY_PILL[entry.kind]} size="sm" />
    </li>
  );
}

function LoadingWidget(): ReactElement {
  return (
    <div
      style={{
        fontFamily: tokens.font.ui,
        fontSize: tokens.fontSize.sm,
        color: tokens.color.muted,
      }}
    >
      {fr.dashboard.loading}
    </div>
  );
}

function EmptyWidget({ children }: { children: React.ReactNode }): ReactElement {
  return (
    <div
      style={{
        fontFamily: tokens.font.ui,
        fontSize: tokens.fontSize.sm,
        color: tokens.color.muted,
      }}
    >
      {children}
    </div>
  );
}
