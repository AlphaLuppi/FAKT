import type { ReactElement } from "react";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { tokens } from "@fakt/design-tokens";
import { StatusPill } from "@fakt/ui";
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
}

function buildQuoteActivity(q: Quote): ActivityEntry {
  const reference = q.number ?? q.id.slice(0, 8);
  if (q.status === "invoiced") {
    return {
      id: `q-${q.id}-inv`,
      kind: "quote-invoiced",
      at: q.updatedAt,
      label: fr.dashboard.activity.quoteInvoiced,
      reference,
      clientId: q.clientId,
    };
  }
  if (q.status === "signed" && q.signedAt) {
    return {
      id: `q-${q.id}-signed`,
      kind: "quote-signed",
      at: q.signedAt,
      label: fr.dashboard.activity.quoteSigned,
      reference,
      clientId: q.clientId,
    };
  }
  if (q.status === "sent" && q.issuedAt) {
    return {
      id: `q-${q.id}-sent`,
      kind: "quote-sent",
      at: q.issuedAt,
      label: fr.dashboard.activity.quoteSent,
      reference,
      clientId: q.clientId,
    };
  }
  return {
    id: `q-${q.id}-created`,
    kind: "quote-created",
    at: q.createdAt,
    label: fr.dashboard.activity.quoteCreated,
    reference,
    clientId: q.clientId,
  };
}

function buildInvoiceActivity(inv: Invoice): ActivityEntry {
  const reference = inv.number ?? inv.id.slice(0, 8);
  if (inv.status === "paid" && inv.paidAt) {
    return {
      id: `i-${inv.id}-paid`,
      kind: "invoice-paid",
      at: inv.paidAt,
      label: fr.dashboard.activity.invoicePaid,
      reference,
      clientId: inv.clientId,
    };
  }
  if (inv.status === "sent" && inv.issuedAt) {
    return {
      id: `i-${inv.id}-sent`,
      kind: "invoice-sent",
      at: inv.issuedAt,
      label: fr.dashboard.activity.invoiceSent,
      reference,
      clientId: inv.clientId,
    };
  }
  return {
    id: `i-${inv.id}-created`,
    kind: "invoice-created",
    at: inv.createdAt,
    label: fr.dashboard.activity.invoiceCreated,
    reference,
    clientId: inv.clientId,
  };
}

export function DashboardRoute(): ReactElement {
  const navigate = useNavigate();
  const { quotes, loading: quotesLoading } = useQuotes();
  const { invoices, loading: invoicesLoading } = useInvoices();

  const pendingQuotes = useMemo(
    () => quotes.filter((q) => q.status === "sent"),
    [quotes],
  );

  const overdueInvoices = useMemo(() => {
    const now = today();
    return invoices.filter(
      (inv) =>
        inv.status === "sent" &&
        inv.dueDate !== null &&
        inv.dueDate < now,
    );
  }, [invoices]);

  const overdueSum = useMemo(
    () => overdueInvoices.reduce((sum, inv) => sum + inv.totalHtCents, 0),
    [overdueInvoices],
  );

  const recentActivity = useMemo((): ActivityEntry[] => {
    const entries: ActivityEntry[] = [
      ...quotes.map(buildQuoteActivity),
      ...invoices.map(buildInvoiceActivity),
    ];
    entries.sort((a, b) => b.at - a.at);
    return entries.slice(0, 5);
  }, [quotes, invoices]);

  const loading = quotesLoading || invoicesLoading;

  return (
    <div
      style={{
        padding: tokens.spacing[6],
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacing[5],
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: tokens.spacing[5],
        }}
      >
        <WidgetCard
          testId="widget-pending-quotes"
          title={fr.dashboard.widgets.pendingQuotesTitle}
          hint={fr.dashboard.widgets.pendingQuotesHint}
          cta={fr.dashboard.widgets.pendingQuotesCta}
          ctaTestId="widget-pending-quotes-cta"
          onCtaClick={() => void navigate("/quotes?status=sent")}
        >
          {loading ? (
            <WidgetLoading />
          ) : pendingQuotes.length === 0 ? (
            <WidgetEmpty>{fr.dashboard.widgets.pendingQuotesEmpty}</WidgetEmpty>
          ) : (
            <WidgetStat
              testId="widget-pending-quotes-count"
              primary={String(pendingQuotes.length)}
              secondary={fr.dashboard.widgets.countQuotes(pendingQuotes.length)}
            />
          )}
        </WidgetCard>

        <WidgetCard
          testId="widget-overdue-invoices"
          title={fr.dashboard.widgets.overdueInvoicesTitle}
          hint={fr.dashboard.widgets.overdueInvoicesHint}
          cta={fr.dashboard.widgets.overdueInvoicesCta}
          ctaTestId="widget-overdue-invoices-cta"
          onCtaClick={() => void navigate("/invoices?overdue=true")}
        >
          {loading ? (
            <WidgetLoading />
          ) : overdueInvoices.length === 0 ? (
            <WidgetEmpty>
              {fr.dashboard.widgets.overdueInvoicesEmpty}
            </WidgetEmpty>
          ) : (
            <WidgetStat
              testId="widget-overdue-invoices-count"
              primary={formatEur(overdueSum)}
              secondary={`${fr.dashboard.widgets.countInvoices(
                overdueInvoices.length,
              )} · ${fr.dashboard.widgets.sumSuffix}`}
              accent="danger"
            />
          )}
        </WidgetCard>
      </div>

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
          <WidgetLoading />
        ) : recentActivity.length === 0 ? (
          <WidgetEmpty>
            {fr.dashboard.widgets.recentActivityEmpty}
          </WidgetEmpty>
        ) : (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {recentActivity.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

interface WidgetCardProps {
  title: string;
  hint: string;
  cta: string;
  testId: string;
  ctaTestId: string;
  onCtaClick: () => void;
  children: ReactElement;
}

function WidgetCard({
  title,
  hint,
  cta,
  testId,
  ctaTestId,
  onCtaClick,
  children,
}: WidgetCardProps): ReactElement {
  return (
    <section
      data-testid={testId}
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
      <div>
        <h2
          style={{
            font: `${tokens.fontWeight.black} ${tokens.fontSize.md}/1 ${tokens.font.ui}`,
            textTransform: "uppercase",
            letterSpacing: "-0.01em",
            margin: 0,
          }}
        >
          {title}
        </h2>
        <p
          style={{
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.xs,
            color: tokens.color.muted,
            margin: 0,
            marginTop: tokens.spacing[1],
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {hint}
        </p>
      </div>
      <div style={{ flex: 1, minHeight: 64 }}>{children}</div>
      <button
        type="button"
        onClick={onCtaClick}
        data-testid={ctaTestId}
        className="fakt-btn fakt-btn--ghost fakt-btn--sm"
        style={{ alignSelf: "flex-start" }}
      >
        {cta}
      </button>
    </section>
  );
}

function WidgetLoading(): ReactElement {
  return (
    <div
      style={{
        fontFamily: tokens.font.ui,
        fontSize: tokens.fontSize.sm,
        color: tokens.color.muted,
      }}
    >
      Chargement…
    </div>
  );
}

function WidgetEmpty({
  children,
}: {
  children: React.ReactNode;
}): ReactElement {
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

interface WidgetStatProps {
  primary: string;
  secondary: string;
  testId: string;
  accent?: "default" | "danger";
}

function WidgetStat({
  primary,
  secondary,
  testId,
  accent = "default",
}: WidgetStatProps): ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing[1] }}>
      <span
        data-testid={testId}
        style={{
          fontFamily: tokens.font.mono,
          fontSize: tokens.fontSize.xl,
          fontWeight: Number(tokens.fontWeight.black),
          fontVariantNumeric: "tabular-nums",
          color: accent === "danger" ? tokens.color.ink : tokens.color.ink,
          background: accent === "danger" ? tokens.color.dangerBg : "transparent",
          padding: accent === "danger" ? "2px 8px" : 0,
          border:
            accent === "danger"
              ? `${tokens.stroke.base} solid ${tokens.color.ink}`
              : undefined,
          alignSelf: "flex-start",
        }}
      >
        {primary}
      </span>
      <span
        style={{
          fontFamily: tokens.font.ui,
          fontSize: tokens.fontSize.xs,
          color: tokens.color.muted,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {secondary}
      </span>
    </div>
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

function ActivityRow({ entry }: { entry: ActivityEntry }): ReactElement {
  return (
    <li
      data-testid={`activity-row-${entry.id}`}
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto",
        alignItems: "center",
        gap: tokens.spacing[3],
        padding: `${tokens.spacing[2]} 0`,
        borderBottom: `${tokens.stroke.hair} solid ${tokens.color.ink}`,
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
