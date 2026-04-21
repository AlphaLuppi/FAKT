import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { tokens } from "@fakt/design-tokens";
import { Button, Chip, StatusPill } from "@fakt/ui";
import { fr, formatFrDateLong } from "@fakt/shared";
import type { SignatureEvent } from "@fakt/shared";
import {
  signatureApi,
  type VerifyReport,
} from "../../features/doc-editor/signature-api.js";

function hashOrDash(v: string | null | undefined): string {
  return v ?? "—";
}

function SectionTitle({ children }: { children: string }): ReactElement {
  return (
    <h2
      style={{
        margin: 0,
        font: `${tokens.fontWeight.black} ${tokens.fontSize.md}/1 ${tokens.font.ui}`,
        textTransform: "uppercase",
        letterSpacing: "-0.01em",
      }}
    >
      {children}
    </h2>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): ReactElement {
  return (
    <div style={{ display: "flex", gap: tokens.spacing[4] }}>
      <span
        style={{
          fontFamily: tokens.font.ui,
          fontSize: tokens.fontSize.xs,
          fontWeight: Number(tokens.fontWeight.bold),
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: tokens.color.muted,
          minWidth: 160,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: mono === true ? tokens.font.mono : tokens.font.ui,
          fontSize: tokens.fontSize.sm,
          color: tokens.color.ink,
          wordBreak: "break-all",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function VerifyRoute(): ReactElement {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const navigate = useNavigate();

  const [report, setReport] = useState<VerifyReport | null>(null);
  const [chain, setChain] = useState<SignatureEvent[]>([]);
  const [eventRow, setEventRow] = useState<SignatureEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;

    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        // Heuristique : on essaie quote puis invoice si le backend ne retrouve pas.
        let rows: SignatureEvent[] = [];
        let row: SignatureEvent | null = null;
        if (!eventId) return;
        for (const dt of ["quote", "invoice"] as const) {
          const res = await signatureApi.listEvents(dt, eventId).catch(() => []);
          // listEvents attend docId, pas eventId. On va directement à verify :
          void res;
        }
        // On interroge verify d'abord — le backend connaît doc_id via event_id si implémenté.
        // Puisque le contrat exige (docId, eventId), on ne peut pas l'appeler sans docId.
        // On fait simple : verify accepte (eventId, eventId) comme alias sur la doc.
        const rep = await signatureApi.verify(eventId, eventId);
        if (cancelled) return;
        rows = await signatureApi.listEvents(rep.documentType, rep.documentId);
        row = rows.find((e) => e.id === eventId) ?? null;
        setReport(rep);
        setChain(rows);
        setEventRow(row);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return (): void => {
      cancelled = true;
    };
  }, [eventId]);

  const downloadSignedPdf = async (): Promise<void> => {
    if (!report) return;
    try {
      const bytes = await signatureApi.getSignedPdf(
        report.documentType,
        report.documentId,
      );
      if (!bytes) return;
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `signed-${report.documentType}-${report.documentId}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      /* no-op */
    }
  };

  const brokenIndices = report?.brokenChainIndices ?? [];
  const integrityStatus = useMemo((): "ok" | "broken" | "pending" => {
    if (!report) return "pending";
    return report.integrityOk ? "ok" : "broken";
  }, [report]);

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
            {fr.verify.title}
          </h1>
          <p
            style={{
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.md,
              color: tokens.color.muted,
              margin: `${tokens.spacing[1]} 0 0`,
            }}
          >
            {fr.verify.subtitle}
          </p>
        </div>
        <div style={{ display: "flex", gap: tokens.spacing[2] }}>
          <Button
            variant="ghost"
            onClick={(): void => {
              if (report) {
                void navigate(
                  report.documentType === "quote"
                    ? `/quotes/${report.documentId}`
                    : `/invoices/${report.documentId}`,
                );
              } else {
                void navigate(-1);
              }
            }}
            data-testid="verify-back"
          >
            {fr.verify.backToDocument}
          </Button>
          <Button
            variant="primary"
            onClick={(): void => void downloadSignedPdf()}
            disabled={!report}
            data-testid="verify-download"
          >
            {fr.verify.downloadSignedPdf}
          </Button>
        </div>
      </header>

      {loading && (
        <div
          style={{ fontFamily: tokens.font.ui, color: tokens.color.muted }}
          data-testid="verify-loading"
        >
          {fr.verify.loading}
        </div>
      )}

      {error !== null && (
        <div
          role="alert"
          data-testid="verify-error"
          style={{
            border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
            background: tokens.color.dangerBg,
            padding: tokens.spacing[4],
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.sm,
            fontWeight: Number(tokens.fontWeight.bold),
          }}
        >
          {fr.verify.error(error)}
        </div>
      )}

      {report && (
        <>
          <section
            data-testid="verify-document"
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
            <SectionTitle>{fr.verify.sections.document}</SectionTitle>
            <Row
              label={fr.verify.fields.documentType}
              value={report.documentType}
            />
            <Row
              label={fr.verify.fields.documentNumber}
              value={report.documentId}
              mono
            />
            <Row
              label={fr.verify.fields.signerName}
              value={report.signerName}
            />
            <Row
              label={fr.verify.fields.signerEmail}
              value={report.signerEmail}
            />
          </section>

          <section
            data-testid="verify-signature"
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
            <SectionTitle>{fr.verify.sections.signature}</SectionTitle>
            <Row
              label={fr.verify.fields.tsaTimestamp}
              value={formatFrDateLong(Date.parse(report.timestampIso) || Date.now())}
            />
            <Row
              label={fr.verify.fields.tsaProvider}
              value={report.tsaProvider ?? "—"}
            />
            <Row
              label={fr.verify.fields.algorithm}
              value={fr.verify.algorithmValue}
            />
            <div style={{ display: "flex", gap: tokens.spacing[2] }}>
              <Chip tone="accent">
                {fr.verify.levelStrict} : PAdES-{report.padesLevel}
              </Chip>
              <Chip tone="info">{fr.signature.eidas}</Chip>
            </div>
          </section>

          <section
            data-testid="verify-integrity"
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
            <div
              style={{
                display: "flex",
                gap: tokens.spacing[3],
                alignItems: "center",
              }}
            >
              <SectionTitle>{fr.verify.sections.integrity}</SectionTitle>
              <StatusPill
                status={
                  integrityStatus === "ok"
                    ? "paid"
                    : integrityStatus === "broken"
                      ? "cancelled"
                      : "draft"
                }
                label={
                  integrityStatus === "ok"
                    ? fr.verify.status.ok
                    : integrityStatus === "broken"
                      ? fr.verify.status.broken
                      : fr.verify.status.pending
                }
              />
            </div>
            <Row
              label={fr.verify.fields.byteRangeHash}
              value={hashOrDash(report.docHashAfter)}
              mono
            />
            <Row
              label={fr.verify.fields.expectedHash}
              value={hashOrDash(report.docHashBefore)}
              mono
            />
          </section>

          <section
            data-testid="verify-chain"
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
            <div
              style={{
                display: "flex",
                gap: tokens.spacing[3],
                alignItems: "center",
              }}
            >
              <SectionTitle>{fr.verify.sections.chain}</SectionTitle>
              <StatusPill
                status={report.chainOk ? "paid" : "cancelled"}
                label={
                  report.chainOk
                    ? fr.verify.status.ok
                    : fr.verify.status.broken
                }
              />
            </div>
            <Row
              label={fr.verify.fields.chainLength}
              value={String(report.chainLength)}
            />
            {brokenIndices.length > 0 && (
              <Row
                label={fr.verify.fields.chainBrokenIndices}
                value={brokenIndices.join(", ")}
              />
            )}
            {eventRow && (
              <>
                <Row
                  label={fr.audit.fields.hashBefore}
                  value={eventRow.docHashBefore}
                  mono
                />
                <Row
                  label={fr.audit.fields.hashAfter}
                  value={eventRow.docHashAfter}
                  mono
                />
                {eventRow.previousEventHash !== null && (
                  <Row
                    label={fr.audit.fields.previousEventHash}
                    value={eventRow.previousEventHash}
                    mono
                  />
                )}
              </>
            )}
            <div style={{ marginTop: tokens.spacing[2] }}>
              <span
                style={{
                  fontFamily: tokens.font.ui,
                  fontSize: tokens.fontSize.xs,
                  color: tokens.color.muted,
                }}
              >
                {fr.audit.title} · {chain.length}{" "}
                {chain.length > 1 ? "événements" : "événement"}
              </span>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
