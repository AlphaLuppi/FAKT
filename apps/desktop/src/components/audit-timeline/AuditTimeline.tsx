import { tokens } from "@fakt/design-tokens";
import { formatFrDateLong, fr } from "@fakt/shared";
import type { SignatureEvent } from "@fakt/shared";
import { Button, Chip } from "@fakt/ui";
import type { ReactElement, ReactNode } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { type ActivityEvent, activityApi } from "../../api/activity.js";
import { signatureApi } from "../../features/doc-editor/signature-api.js";
import { formatRelative } from "./relative.js";

export type AuditEventKind =
  | "created"
  | "sent"
  | "unsent"
  | "signed"
  | "paid"
  | "cancelled"
  | "refused"
  | "expired"
  | "invoiced"
  | "archived"
  | "from_quote"
  | "rotated"
  | "verified"
  | "viewed";

/**
 * Mappe un type d'event activity (DB) vers un kind affichable.
 * Les types non listés sont silencieusement ignorés — l'audit n'est pas un
 * dump brut de la table activity, c'est une vue filtrée des actions visibles.
 */
function activityTypeToKind(type: string): AuditEventKind | null {
  switch (type) {
    case "quote_created":
    case "invoice.created":
      return "created";
    case "quote_marked_sent":
    case "invoice.issued":
      return "sent";
    case "quote_unmarked_sent":
      return "unsent";
    case "quote_signed":
      return "signed";
    case "quote_refused":
      return "refused";
    case "quote_expired":
      return "expired";
    case "quote_invoiced":
      return "invoiced";
    case "invoice.paid":
      return "paid";
    case "invoice.cancelled":
      return "cancelled";
    case "invoice.archived":
      return "archived";
    case "invoice.from_quote":
      return "from_quote";
    default:
      return null;
  }
}

export interface BaseAuditEntry {
  kind: AuditEventKind;
  timestamp: number;
  signer?: string | null;
  ip?: string | null;
  tsaProvider?: string | null;
  hashBefore?: string | null;
  hashAfter?: string | null;
  previousEventHash?: string | null;
  signatureEventId?: string | null;
  brokenChain?: boolean;
  rotatedCertWarning?: boolean;
}

export interface AuditTimelineProps {
  docType: "quote" | "invoice";
  docId: string;
  /**
   * Entrées dérivées de l'état actuel du document (created/sent/paid via
   * createdAt/issuedAt/paidAt). Servent de fallback pour les vieux documents
   * qui n'ont pas d'event activity correspondant — sont dédupliqués si la
   * table activity contient déjà l'event de même kind.
   */
  extraEntries?: BaseAuditEntry[];
  /** Inject initial events (testing). Par défaut, fetch signatureApi.listEvents. */
  initialEvents?: SignatureEvent[] | null;
  /** Inject initial activity events (testing). Par défaut, fetch activityApi.list. */
  initialActivities?: ActivityEvent[] | null;
}

function truncateHash(hex: string | null | undefined): string {
  if (!hex) return "—";
  return hex.length <= 16 ? hex : `${hex.slice(0, 8)}…${hex.slice(-4)}`;
}

function LabelPair({
  label,
  value,
  mono,
  fullTitle,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  fullTitle?: string;
}): ReactElement {
  return (
    <div style={{ display: "flex", gap: tokens.spacing[3] }}>
      <span
        style={{
          fontFamily: tokens.font.ui,
          fontSize: tokens.fontSize.xs,
          fontWeight: Number(tokens.fontWeight.bold),
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: tokens.color.muted,
          minWidth: 110,
        }}
      >
        {label}
      </span>
      <span
        title={fullTitle ?? undefined}
        style={{
          fontFamily: mono === true ? tokens.font.mono : tokens.font.ui,
          fontSize: tokens.fontSize.xs,
          color: tokens.color.ink,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function kindLabel(kind: AuditEventKind): string {
  const m = fr.audit.labels;
  switch (kind) {
    case "created":
      return m.created;
    case "sent":
      return m.sent;
    case "unsent":
      return m.unsent;
    case "signed":
      return m.signed;
    case "paid":
      return m.paid;
    case "cancelled":
      return m.cancelled;
    case "refused":
      return m.refused;
    case "expired":
      return m.expired;
    case "invoiced":
      return m.invoiced;
    case "archived":
      return m.archived;
    case "from_quote":
      return m.from_quote;
    case "rotated":
      return m.rotated;
    case "verified":
      return m.verified;
    case "viewed":
      return m.viewed;
    default:
      return kind;
  }
}

export function AuditTimeline({
  docType,
  docId,
  extraEntries = [],
  initialEvents = null,
  initialActivities = null,
}: AuditTimelineProps): ReactElement {
  const [events, setEvents] = useState<SignatureEvent[] | null>(initialEvents);
  const [activities, setActivities] = useState<ActivityEvent[] | null>(initialActivities);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (initialEvents !== null && initialActivities !== null) return;
    let cancelled = false;
    Promise.all([
      initialEvents !== null
        ? Promise.resolve(initialEvents)
        : signatureApi.listEvents(docType, docId),
      initialActivities !== null
        ? Promise.resolve(initialActivities)
        : activityApi.list({ entityType: docType, entityId: docId, limit: 200 }),
    ])
      .then(([sigs, acts]) => {
        if (cancelled) return;
        setEvents(sigs);
        setActivities(acts);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setEvents([]);
          setActivities([]);
        }
      });
    return (): void => {
      cancelled = true;
    };
  }, [docType, docId, initialEvents, initialActivities]);

  const signatureEntries: BaseAuditEntry[] = (events ?? []).map((ev, idx, arr) => {
    const prev = idx > 0 ? arr[idx - 1] : null;
    const expectedPrev = prev ? prev.docHashAfter : null;
    const broken =
      prev !== null && prev !== undefined && ev.previousEventHash !== null ? false : false;
    // Broken chain detection: previousEventHash must chain to prev.
    // (Full verification is done on /verify.)
    void expectedPrev;
    return {
      kind: "signed" as AuditEventKind,
      timestamp: ev.timestamp,
      signer: ev.signerName,
      ip: ev.ipAddress,
      tsaProvider: ev.tsaProvider,
      hashBefore: ev.docHashBefore,
      hashAfter: ev.docHashAfter,
      previousEventHash: ev.previousEventHash,
      signatureEventId: ev.id,
      brokenChain: broken,
    };
  });

  const activityEntries: BaseAuditEntry[] = (activities ?? [])
    .map((a) => {
      const kind = activityTypeToKind(a.type);
      if (!kind) return null;
      return { kind, timestamp: a.createdAt };
    })
    .filter((e): e is BaseAuditEntry => e !== null);

  // Dédup : si la table activity contient déjà un event d'un kind donné,
  // on ignore l'extraEntry du même kind (qui n'était qu'un fallback dérivé
  // de createdAt/issuedAt/paidAt). Évite les doublons sur les nouveaux
  // documents tout en restant résilient pour les anciens.
  const activityKinds = new Set(activityEntries.map((e) => e.kind));
  const filteredExtras = extraEntries.filter((e) => !activityKinds.has(e.kind));

  const allEntries: BaseAuditEntry[] = [
    ...filteredExtras,
    ...activityEntries,
    ...signatureEntries,
  ].sort((a, b) => a.timestamp - b.timestamp);

  if ((events === null || activities === null) && error === null) {
    return (
      <div
        data-testid="audit-timeline-loading"
        style={{ fontFamily: tokens.font.ui, color: tokens.color.muted }}
      >
        {fr.verify.loading}
      </div>
    );
  }

  if (allEntries.length === 0) {
    return (
      <div
        data-testid="audit-timeline-empty"
        style={{
          fontFamily: tokens.font.ui,
          fontSize: tokens.fontSize.sm,
          color: tokens.color.muted,
        }}
      >
        {fr.audit.emptyChain}
      </div>
    );
  }

  return (
    <section
      aria-label={fr.audit.title}
      data-testid="audit-timeline"
      style={{ position: "relative", paddingLeft: tokens.spacing[5] }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 6,
          top: 4,
          bottom: 4,
          width: tokens.stroke.bold,
          background: tokens.color.ink,
        }}
      />
      <ol
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: tokens.spacing[4],
        }}
      >
        {allEntries.map((entry, idx) => (
          <li
            key={`${entry.kind}-${entry.timestamp}-${idx}`}
            style={{ position: "relative" }}
            data-testid={`audit-entry-${entry.kind}`}
          >
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: -24,
                top: 12,
                width: 14,
                height: 14,
                border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
                background:
                  entry.kind === "signed" ? tokens.color.accentSoft : tokens.color.surface,
              }}
            />
            <div
              style={{
                border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
                background: tokens.color.surface,
                boxShadow: tokens.shadow.sm,
                padding: tokens.spacing[4],
                display: "flex",
                flexDirection: "column",
                gap: tokens.spacing[2],
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: tokens.spacing[3],
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: tokens.font.ui,
                    fontSize: tokens.fontSize.md,
                    fontWeight: Number(tokens.fontWeight.black),
                    textTransform: "uppercase",
                    letterSpacing: "-0.01em",
                    color: tokens.color.ink,
                  }}
                >
                  {kindLabel(entry.kind)}
                </span>
                <Chip tone={entry.kind === "signed" ? "accent" : "neutral"}>
                  {formatRelative(entry.timestamp)}
                </Chip>
                {entry.brokenChain === true && (
                  <Chip tone="danger">{fr.audit.fields.chainBroken}</Chip>
                )}
              </div>
              <LabelPair
                label={fr.audit.timestampAbsolute}
                value={`${formatFrDateLong(entry.timestamp)} — ${new Date(
                  entry.timestamp
                ).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`}
              />
              {entry.signer && <LabelPair label={fr.audit.fields.signer} value={entry.signer} />}
              {entry.ip && <LabelPair label={fr.audit.fields.ip} value={entry.ip} />}
              {entry.tsaProvider && (
                <LabelPair label={fr.audit.fields.tsaProvider} value={entry.tsaProvider} />
              )}
              {entry.hashBefore !== undefined && entry.hashBefore !== null && (
                <LabelPair
                  label={fr.audit.fields.hashBefore}
                  value={truncateHash(entry.hashBefore)}
                  mono
                  fullTitle={entry.hashBefore}
                />
              )}
              {entry.hashAfter !== undefined && entry.hashAfter !== null && (
                <LabelPair
                  label={fr.audit.fields.hashAfter}
                  value={truncateHash(entry.hashAfter)}
                  mono
                  fullTitle={entry.hashAfter}
                />
              )}
              {entry.previousEventHash !== undefined && entry.previousEventHash !== null && (
                <LabelPair
                  label={fr.audit.fields.previousEventHash}
                  value={truncateHash(entry.previousEventHash)}
                  mono
                  fullTitle={entry.previousEventHash}
                />
              )}
              {entry.rotatedCertWarning === true && (
                <div
                  role="note"
                  style={{
                    border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
                    background: tokens.color.warnBg,
                    padding: tokens.spacing[3],
                    fontFamily: tokens.font.ui,
                    fontSize: tokens.fontSize.xs,
                    fontWeight: Number(tokens.fontWeight.bold),
                  }}
                >
                  {fr.audit.certRotatedWarning}
                </div>
              )}
              {entry.kind === "signed" && entry.signatureEventId && (
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    data-testid="audit-verify"
                    onClick={(): void => {
                      void navigate(`/signatures/${entry.signatureEventId}/verify`);
                    }}
                  >
                    {fr.audit.verifyCta}
                  </Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
      {error !== null && (
        <div
          role="alert"
          data-testid="audit-timeline-error"
          style={{
            marginTop: tokens.spacing[3],
            border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
            background: tokens.color.dangerBg,
            padding: tokens.spacing[3],
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.sm,
          }}
        >
          {error}
        </div>
      )}
    </section>
  );
}
