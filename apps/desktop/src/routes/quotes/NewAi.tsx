import { type ExtractedQuote, type ExtractedQuoteItem, getAi } from "@fakt/ai";
import { tokens } from "@fakt/design-tokens";
import { addDays, formatEur, fr, today } from "@fakt/shared";
import type { DocumentUnit } from "@fakt/shared";
import { Button, Textarea } from "@fakt/ui";
import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { quotesApi } from "../../features/doc-editor/quotes-api.js";
import { QuoteForm, type QuoteFormValues } from "./QuoteForm.js";

function mapExtractedUnit(u: ExtractedQuoteItem["unit"]): DocumentUnit {
  switch (u) {
    case "hour":
      return "heure";
    case "day":
      return "jour";
    case "forfait":
      return "forfait";
    default:
      return "unité";
  }
}

export function NewAi(): ReactElement {
  const navigate = useNavigate();
  const [brief, setBrief] = useState<string>("");
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<Partial<ExtractedQuote> | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [cliMissing, setCliMissing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    const provider = getAi();
    provider
      .healthCheck()
      .then((info) => {
        if (!cancelled) setCliMissing(!info.installed);
      })
      .catch(() => {
        if (!cancelled) setCliMissing(true);
      });
    return (): void => {
      cancelled = true;
    };
  }, []);

  async function handleExtract(): Promise<void> {
    if (brief.trim().length === 0) return;
    setExtracting(true);
    setExtracted(null);
    setStreamError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const provider = getAi();
      const stream = provider.extractQuoteFromBrief(brief, {
        signal: controller.signal,
      });

      for await (const event of stream) {
        if (event.type === "delta") {
          setExtracted((prev) => ({ ...(prev ?? {}), ...event.data }));
        } else if (event.type === "done") {
          setExtracted(event.data);
        } else if (event.type === "error") {
          setStreamError(event.message);
          if (event.message.includes("CLI") || event.message.toLowerCase().includes("claude")) {
            setCliMissing(true);
          }
        }
      }
    } catch (err) {
      if (!(err instanceof Error) || err.name !== "AbortError") {
        setStreamError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setExtracting(false);
      abortRef.current = null;
    }
  }

  function handleCancel(): void {
    abortRef.current?.abort();
    abortRef.current = null;
    setExtracting(false);
  }

  async function handleApply(): Promise<void> {
    if (!extracted || !extracted.items) return;
    const issuedAt = today();
    const items = (extracted.items ?? []).map((it, idx) => ({
      id: `tmp-${idx}-${Date.now().toString(36)}`,
      position: idx,
      description: it.description,
      quantity: Math.round((it.quantity || 1) * 1000),
      unitPriceCents: Math.round((it.unitPrice || 0) * 100),
      unit: mapExtractedUnit(it.unit),
      lineTotalCents: Math.round((it.quantity || 1) * (it.unitPrice || 0) * 100),
      serviceId: null,
    }));
    const initial: Partial<QuoteFormValues> = {
      title: extracted.client?.name ? `Devis — ${extracted.client.name}` : "Devis",
      issuedAt,
      validityDate: extracted.validUntil
        ? new Date(extracted.validUntil).getTime()
        : addDays(issuedAt, 30),
      notes: extracted.notes ?? "",
      items,
    };
    setApplied(initial);
  }

  const [applied, setApplied] = useState<Partial<QuoteFormValues> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmitApplied(values: QuoteFormValues, issueNumber: boolean): Promise<void> {
    // Guard synchrone double-submit.
    if (submitting) return;
    if (!values.clientId) {
      setSubmitError(fr.quotes.errors.missingClient);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await quotesApi.create({
        clientId: values.clientId,
        title: values.title.trim(),
        conditions: null,
        validityDate: values.validityDate,
        notes: values.notes.trim().length > 0 ? values.notes : null,
        totalHtCents: values.items.reduce((s, i) => s + i.lineTotalCents, 0),
        items: values.items.map((i) => ({
          id: i.id,
          position: i.position,
          description: i.description,
          quantity: i.quantity,
          unitPriceCents: i.unitPriceCents,
          unit: i.unit,
          lineTotalCents: i.lineTotalCents,
          serviceId: i.serviceId,
        })),
        issueNumber,
      });
      void navigate(`/quotes/${created.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : fr.quotes.errors.createFailed);
    } finally {
      setSubmitting(false);
    }
  }

  if (cliMissing && !extracted) {
    return <CliMissingBlock onFallback={() => setCliMissing(false)} />;
  }

  if (applied) {
    return (
      <div
        style={{
          padding: tokens.spacing[6],
          display: "flex",
          flexDirection: "column",
          gap: tokens.spacing[5],
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h1
            style={{
              font: `var(--w-black) var(--t-2xl)/1 ${tokens.font.ui}`,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              color: tokens.color.ink,
              margin: 0,
            }}
          >
            {fr.quotes.new} · {fr.quotes.modes.ai}
          </h1>
          <Button variant="ghost" onClick={() => setApplied(null)}>
            {fr.quotes.actions.cancel}
          </Button>
        </header>
        <QuoteForm
          initial={applied}
          onSubmit={handleSubmitApplied}
          onCancel={() => setApplied(null)}
          submitting={submitting}
          submitError={submitError}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        padding: tokens.spacing[6],
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacing[5],
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
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
            {fr.quotes.new}
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
            {fr.quotes.modes.ai}
          </p>
        </div>
        <Button variant="ghost" onClick={() => void navigate("/quotes")}>
          {fr.quotes.actions.backToList}
        </Button>
      </header>

      <section
        style={{
          border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
          background: tokens.color.surface,
          padding: tokens.spacing[5],
          boxShadow: tokens.shadow.sm,
          display: "flex",
          flexDirection: "column",
          gap: tokens.spacing[3],
        }}
      >
        <Textarea
          aria-label={fr.quotes.ai.briefLabel}
          label={fr.quotes.ai.briefLabel}
          placeholder={fr.quotes.ai.briefPlaceholder}
          value={brief}
          rows={6}
          onChange={(e) => setBrief(e.target.value)}
          disabled={extracting}
          data-testid="ai-brief"
        />
        <div
          style={{
            display: "flex",
            gap: tokens.spacing[2],
            justifyContent: "flex-end",
          }}
        >
          {extracting ? (
            <Button variant="danger" onClick={handleCancel} data-testid="ai-cancel">
              {fr.quotes.ai.cancel}
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => void handleExtract()}
              disabled={brief.trim().length === 0}
              data-testid="ai-extract"
            >
              {fr.quotes.ai.extract}
            </Button>
          )}
        </div>
      </section>

      {extracting && !extracted && (
        <div
          data-testid="ai-loading"
          style={{
            border: `${tokens.stroke.base} dashed ${tokens.color.ink}`,
            padding: tokens.spacing[5],
            textAlign: "center",
            fontFamily: tokens.font.ui,
            color: tokens.color.muted,
          }}
        >
          {fr.quotes.ai.extracting}
        </div>
      )}

      {streamError && (
        <div
          role="alert"
          data-testid="ai-error"
          style={{
            border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
            background: tokens.color.dangerBg,
            padding: tokens.spacing[4],
            fontFamily: tokens.font.ui,
            fontWeight: Number(tokens.fontWeight.bold),
          }}
        >
          {streamError}
        </div>
      )}

      {extracted && <ExtractedPreview extracted={extracted} onApply={() => void handleApply()} />}
    </div>
  );
}

function ExtractedPreview({
  extracted,
  onApply,
}: {
  extracted: Partial<ExtractedQuote>;
  onApply: () => void;
}): ReactElement {
  const total = (extracted.items ?? []).reduce(
    (s, it) => s + (it.quantity || 1) * (it.unitPrice || 0),
    0
  );
  return (
    <section
      data-testid="ai-extracted"
      style={{
        border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
        background: tokens.color.surface,
        boxShadow: tokens.shadow.sm,
      }}
    >
      <div
        style={{
          padding: `${tokens.spacing[3]} ${tokens.spacing[5]}`,
          background: tokens.color.accentSoft,
          borderBottom: `${tokens.stroke.base} solid ${tokens.color.ink}`,
          fontFamily: tokens.font.ui,
          fontWeight: Number(tokens.fontWeight.black),
          textTransform: "uppercase",
          letterSpacing: "-0.01em",
          fontSize: tokens.fontSize.md,
        }}
      >
        {fr.quotes.ai.extractedTitle}
      </div>
      <div
        style={{
          padding: tokens.spacing[5],
          display: "flex",
          flexDirection: "column",
          gap: tokens.spacing[3],
        }}
      >
        {extracted.client && (
          <div>
            <div
              style={{
                fontFamily: tokens.font.ui,
                fontSize: tokens.fontSize.xs,
                fontWeight: Number(tokens.fontWeight.bold),
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: tokens.color.muted,
              }}
            >
              {fr.quotes.ai.extractedClient}
            </div>
            <div
              style={{
                fontFamily: tokens.font.ui,
                fontSize: tokens.fontSize.md,
                fontWeight: Number(tokens.fontWeight.bold),
                color: tokens.color.ink,
              }}
            >
              {extracted.client.name}
            </div>
            {extracted.client.email && (
              <div
                style={{
                  fontFamily: tokens.font.ui,
                  fontSize: tokens.fontSize.sm,
                  color: tokens.color.muted,
                }}
              >
                {extracted.client.email}
              </div>
            )}
          </div>
        )}

        {extracted.items && extracted.items.length > 0 && (
          <div>
            <div
              style={{
                fontFamily: tokens.font.ui,
                fontSize: tokens.fontSize.xs,
                fontWeight: Number(tokens.fontWeight.bold),
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: tokens.color.muted,
                marginBottom: tokens.spacing[2],
              }}
            >
              {fr.quotes.ai.extractedItems}
            </div>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: tokens.spacing[1],
              }}
            >
              {extracted.items.map((item, idx) => (
                <li
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
                    border: `1.5px solid ${tokens.color.line}`,
                    fontFamily: tokens.font.ui,
                    fontSize: tokens.fontSize.sm,
                  }}
                >
                  <span>{item.description}</span>
                  <span
                    style={{
                      fontFamily: tokens.font.mono,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {item.quantity} {mapExtractedUnit(item.unit)} ×{" "}
                    {formatEur(Math.round(item.unitPrice * 100))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `${tokens.stroke.base} solid ${tokens.color.ink}`,
            paddingTop: tokens.spacing[3],
          }}
        >
          <span
            style={{
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.xs,
              fontWeight: Number(tokens.fontWeight.bold),
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: tokens.color.muted,
            }}
          >
            {fr.quotes.ai.extractedTotal}
          </span>
          <span
            style={{
              fontFamily: tokens.font.mono,
              fontSize: tokens.fontSize.lg,
              fontWeight: Number(tokens.fontWeight.black),
              fontVariantNumeric: "tabular-nums",
            }}
            data-testid="ai-extracted-total"
          >
            {formatEur(Math.round(total * 100))}
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            variant="primary"
            onClick={onApply}
            data-testid="ai-apply"
            disabled={!extracted.items || extracted.items.length === 0}
          >
            {fr.quotes.ai.applyAndEdit}
          </Button>
        </div>
      </div>
    </section>
  );
}

function CliMissingBlock({ onFallback }: { onFallback: () => void }): ReactElement {
  const navigate = useNavigate();
  return (
    <div
      data-testid="ai-cli-missing"
      style={{
        padding: tokens.spacing[6],
        maxWidth: 700,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
          background: tokens.color.warnBg,
          padding: tokens.spacing[6],
          boxShadow: tokens.shadow.sm,
          display: "flex",
          flexDirection: "column",
          gap: tokens.spacing[4],
        }}
      >
        <h2
          style={{
            font: `${tokens.fontWeight.black} ${tokens.fontSize.xl}/1 ${tokens.font.ui}`,
            textTransform: "uppercase",
            color: tokens.color.ink,
            margin: 0,
          }}
        >
          {fr.quotes.ai.cliMissingTitle}
        </h2>
        <p
          style={{
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.sm,
            color: tokens.color.ink,
            margin: 0,
          }}
        >
          {fr.quotes.ai.cliMissingDetail}
        </p>
        <div style={{ display: "flex", gap: tokens.spacing[2] }}>
          <Button variant="primary" onClick={() => void navigate("/settings")}>
            {fr.quotes.ai.goSettings}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              onFallback();
              void navigate("/quotes/new?mode=manual");
            }}
          >
            {fr.quotes.ai.goManual}
          </Button>
        </div>
      </div>
    </div>
  );
}
