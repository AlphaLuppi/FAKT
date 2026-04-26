import {
  type ExtractedQuote,
  type ExtractedQuoteItem,
  SUPPORTED_ACCEPT,
  getAi,
  parseFile,
} from "@fakt/ai";
import { tokens } from "@fakt/design-tokens";
import { addDays, formatEur, fr, today } from "@fakt/shared";
import type { DocumentUnit } from "@fakt/shared";
import { Button, Dropzone, Input, Textarea } from "@fakt/ui";
import type { ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { quotesApi } from "../../features/doc-editor/quotes-api.js";
import { QuoteForm, type QuoteFormValues } from "./QuoteForm.js";

type ExtractedUnit = ExtractedQuoteItem["unit"];

function mapExtractedUnit(u: ExtractedUnit): DocumentUnit {
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

function isStructuredQuote(value: unknown): value is Partial<ExtractedQuote> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  if ("text" in obj && Object.keys(obj).length === 1) return false;
  const knownKeys = ["client", "items", "validUntil", "notes", "depositPercent"];
  return knownKeys.some((k) => k in obj);
}

function stringifyRawOutput(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

type FileStatus = "parsing" | "ready" | "error";

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  status: FileStatus;
  text: string;
  error?: string;
}

type InputMode = "text" | "file";

function newFileId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `f-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export function NewAi(): ReactElement {
  const navigate = useNavigate();
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [brief, setBrief] = useState<string>("");
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<Partial<ExtractedQuote> | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [cliMissing, setCliMissing] = useState(false);
  const [rawOutput, setRawOutput] = useState<string | null>(null);
  const [showRawOutput, setShowRawOutput] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const parseCancelTokens = useRef<Map<string, () => void>>(new Map());

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

  const briefForExtract = useMemo<string>(() => {
    if (inputMode === "text") return brief.trim();
    const ready = files.filter((f) => f.status === "ready" && f.text.trim().length > 0);
    if (ready.length === 0) return "";
    return ready.map((f) => `--- Contenu de ${f.name} ---\n\n${f.text}`).join("\n\n");
  }, [inputMode, brief, files]);

  const canExtract = briefForExtract.length > 0;
  const filesParsing = files.some((f) => f.status === "parsing");

  async function handleExtract(): Promise<void> {
    if (!canExtract) return;
    setExtracting(true);
    setExtracted(null);
    setStreamError(null);
    setRawOutput(null);
    setShowRawOutput(false);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const provider = getAi();
      const stream = provider.extractQuoteFromBrief(briefForExtract, {
        signal: controller.signal,
      });

      for await (const event of stream) {
        if (event.type === "delta") {
          if (isStructuredQuote(event.data)) {
            setExtracted((prev) => ({ ...(prev ?? {}), ...event.data }));
          } else {
            setRawOutput((prev) =>
              prev === null
                ? stringifyRawOutput(event.data)
                : prev + stringifyRawOutput(event.data)
            );
          }
        } else if (event.type === "done") {
          setRawOutput(stringifyRawOutput(event.data));
          if (isStructuredQuote(event.data)) {
            setExtracted(event.data);
          } else {
            setStreamError(fr.quotes.ai.extractFailedDetail);
          }
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

  async function handleDroppedFiles(dropped: File[]): Promise<void> {
    if (dropped.length === 0) return;
    // Bascule auto sur l'onglet fichier si l'utilisateur drop depuis l'onglet texte.
    setInputMode("file");

    const newAttached: AttachedFile[] = dropped.map((file) => ({
      id: newFileId(),
      name: file.name,
      size: file.size,
      status: "parsing" as FileStatus,
      text: "",
    }));
    setFiles((prev) => [...prev, ...newAttached]);

    for (let i = 0; i < dropped.length; i++) {
      const file = dropped[i];
      const attached = newAttached[i];
      if (!file || !attached) continue;
      let cancelled = false;
      parseCancelTokens.current.set(attached.id, () => {
        cancelled = true;
      });
      try {
        const parsed = await parseFile(file);
        if (cancelled) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === attached.id
                ? { ...f, status: "error", error: "Lecture annulée." }
                : f
            )
          );
          continue;
        }
        if (parsed.text.trim().length === 0) {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === attached.id
                ? { ...f, status: "error", error: "Fichier vide ou non-lisible." }
                : f
            )
          );
        } else {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === attached.id ? { ...f, status: "ready", text: parsed.text } : f
            )
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setFiles((prev) =>
          prev.map((f) => (f.id === attached.id ? { ...f, status: "error", error: msg } : f))
        );
      } finally {
        parseCancelTokens.current.delete(attached.id);
      }
    }
  }

  function handleRemoveFile(id: string): void {
    const cancel = parseCancelTokens.current.get(id);
    if (cancel) {
      cancel();
      parseCancelTokens.current.delete(id);
    }
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  async function handleApply(edited: ExtractedQuote): Promise<void> {
    const issuedAt = today();
    const items = edited.items.map((it, idx) => ({
      id: crypto.randomUUID(),
      position: idx,
      description: it.description,
      quantity: Math.round((it.quantity || 1) * 1000),
      unitPriceCents: Math.round((it.unitPrice || 0) * 100),
      unit: mapExtractedUnit(it.unit),
      lineTotalCents: Math.round((it.quantity || 1) * (it.unitPrice || 0) * 100),
      serviceId: null,
    }));
    const initial: Partial<QuoteFormValues> = {
      title: edited.client?.name ? `Devis — ${edited.client.name}` : "Devis",
      issuedAt,
      validityDate: edited.validUntil
        ? new Date(edited.validUntil).getTime()
        : addDays(issuedAt, 30),
      notes: edited.notes ?? "",
      items,
    };
    setApplied(initial);
  }

  const [applied, setApplied] = useState<Partial<QuoteFormValues> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmitApplied(values: QuoteFormValues, issueNumber: boolean): Promise<void> {
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
          <Button
            variant="ghost"
            onClick={() => setApplied(null)}
            data-testid="quote-new-ai-cancel-applied"
          >
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
        <Button
          variant="ghost"
          onClick={() => void navigate("/quotes")}
          data-testid="quote-new-ai-back"
        >
          {fr.quotes.actions.backToList}
        </Button>
      </header>

      <section
        style={{
          border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
          background: tokens.color.surface,
          boxShadow: tokens.shadow.sm,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <InputModeTabs
          mode={inputMode}
          onChange={setInputMode}
          fileCount={files.length}
          briefFilled={brief.trim().length > 0}
        />

        <div
          style={{
            padding: tokens.spacing[5],
            display: "flex",
            flexDirection: "column",
            gap: tokens.spacing[4],
          }}
        >
          {inputMode === "text" ? (
            <Textarea
              aria-label={fr.quotes.ai.briefLabel}
              label={fr.quotes.ai.briefLabel}
              placeholder={fr.quotes.ai.briefPlaceholder}
              value={brief}
              rows={8}
              onChange={(e) => setBrief(e.target.value)}
              disabled={extracting}
              data-testid="ai-brief"
            />
          ) : (
            <FileInputPanel
              files={files}
              onFiles={handleDroppedFiles}
              onRemove={handleRemoveFile}
              disabled={extracting}
            />
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: tokens.spacing[3],
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontFamily: tokens.font.ui,
                fontSize: tokens.fontSize.xs,
                color: tokens.color.muted,
                fontWeight: Number(tokens.fontWeight.med),
              }}
              data-testid="ai-extract-hint"
            >
              {canExtract
                ? fr.quotes.ai.tabFileHint && inputMode === "file"
                  ? fr.quotes.ai.tabFileHint
                  : fr.quotes.ai.tabTextHint
                : fr.quotes.ai.noContentHint}
            </span>
            {extracting ? (
              <Button variant="danger" onClick={handleCancel} data-testid="ai-cancel">
                {fr.quotes.ai.cancel}
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => void handleExtract()}
                disabled={!canExtract || filesParsing}
                data-testid="ai-extract"
              >
                {fr.quotes.ai.extract}
              </Button>
            )}
          </div>
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

      {extracted && (
        <ExtractedEditor
          extracted={extracted}
          onApply={(edited) => void handleApply(edited)}
        />
      )}

      {rawOutput !== null && (
        <RawOutputToggle
          rawOutput={rawOutput}
          expanded={showRawOutput}
          onToggle={() => setShowRawOutput((v) => !v)}
        />
      )}
    </div>
  );
}

interface InputModeTabsProps {
  mode: InputMode;
  onChange: (m: InputMode) => void;
  fileCount: number;
  briefFilled: boolean;
}

function InputModeTabs({
  mode,
  onChange,
  fileCount,
  briefFilled,
}: InputModeTabsProps): ReactElement {
  const tabs: ReadonlyArray<{
    value: InputMode;
    label: string;
    badge: string | null;
    testId: string;
  }> = [
    {
      value: "text",
      label: fr.quotes.ai.tabText,
      badge: briefFilled ? "•" : null,
      testId: "ai-tab-text",
    },
    {
      value: "file",
      label: fr.quotes.ai.tabFile,
      badge: fileCount > 0 ? String(fileCount) : null,
      testId: "ai-tab-file",
    },
  ];

  return (
    <div
      role="tablist"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        borderBottom: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
      }}
    >
      {tabs.map((t, idx) => {
        const active = mode === t.value;
        const isFirst = idx === 0;
        return (
          <button
            type="button"
            key={t.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            data-testid={t.testId}
            style={{
              padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
              border: "none",
              borderRight: isFirst ? `${tokens.stroke.bold} solid ${tokens.color.ink}` : "none",
              background: active ? tokens.color.ink : tokens.color.surface,
              color: active ? tokens.color.accentSoft : tokens.color.ink,
              fontFamily: tokens.font.ui,
              fontWeight: Number(tokens.fontWeight.black),
              fontSize: tokens.fontSize.sm,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: tokens.spacing[2],
            }}
          >
            <span>{t.label}</span>
            {t.badge !== null && (
              <span
                aria-hidden="true"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 22,
                  height: 22,
                  padding: "0 6px",
                  fontFamily: tokens.font.mono,
                  fontSize: tokens.fontSize.xs,
                  fontWeight: Number(tokens.fontWeight.bold),
                  border: `${tokens.stroke.hair} solid ${active ? tokens.color.accentSoft : tokens.color.ink}`,
                  background: active ? tokens.color.ink : tokens.color.accentSoft,
                  color: active ? tokens.color.accentSoft : tokens.color.ink,
                }}
              >
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface FileInputPanelProps {
  files: AttachedFile[];
  onFiles: (files: File[]) => void | Promise<void>;
  onRemove: (id: string) => void;
  disabled: boolean;
}

function FileInputPanel({
  files,
  onFiles,
  onRemove,
  disabled,
}: FileInputPanelProps): ReactElement {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: tokens.spacing[3] }}
      data-testid="ai-file-panel"
    >
      <Dropzone
        onFiles={onFiles}
        accept={SUPPORTED_ACCEPT}
        disabled={disabled}
        label="DÉPOSE TON FICHIER ICI"
        data-testid="ai-dropzone"
      >
        <div
          style={{
            border: `${tokens.stroke.base} dashed ${tokens.color.ink}`,
            padding: tokens.spacing[6],
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: tokens.spacing[2],
            background: tokens.color.paper,
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              fontSize: tokens.fontSize.xl,
              fontFamily: tokens.font.mono,
              fontWeight: Number(tokens.fontWeight.black),
            }}
          >
            ⬇
          </span>
          <span
            style={{
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.md,
              fontWeight: Number(tokens.fontWeight.black),
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {fr.quotes.ai.dropzoneTitle}
          </span>
          <span
            data-testid="ai-dropzone-hint"
            style={{
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.xs,
              color: tokens.color.muted,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {fr.quotes.ai.dropzoneFormats}
          </span>
        </div>
      </Dropzone>

      {files.length > 0 && (
        <ul
          data-testid="ai-file-list"
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: tokens.spacing[2],
          }}
        >
          {files.map((f) => (
            <li key={f.id}>
              <FileCard file={f} onRemove={() => onRemove(f.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface FileCardProps {
  file: AttachedFile;
  onRemove: () => void;
}

function FileCard({ file, onRemove }: FileCardProps): ReactElement {
  const statusLabel =
    file.status === "parsing"
      ? fr.quotes.ai.fileCardParsing
      : file.status === "ready"
        ? fr.quotes.ai.fileCardReady
        : (file.error ?? fr.quotes.ai.fileCardError);

  const statusBg =
    file.status === "ready"
      ? tokens.color.accentSoft
      : file.status === "error"
        ? tokens.color.dangerBg
        : tokens.color.paper;

  return (
    <div
      data-testid={`ai-file-card-${file.id}`}
      data-status={file.status}
      style={{
        display: "flex",
        alignItems: "center",
        gap: tokens.spacing[3],
        padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
        border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
        background: tokens.color.surface,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          fontFamily: tokens.font.mono,
          fontWeight: Number(tokens.fontWeight.black),
          fontSize: tokens.fontSize.sm,
          width: 32,
          height: 32,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: `${tokens.stroke.hair} solid ${tokens.color.ink}`,
          background: statusBg,
        }}
      >
        {file.status === "parsing" ? "…" : file.status === "ready" ? "✓" : "!"}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.sm,
            fontWeight: Number(tokens.fontWeight.bold),
            color: tokens.color.ink,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {file.name}
        </div>
        <div
          style={{
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.xs,
            color: tokens.color.muted,
            display: "flex",
            gap: tokens.spacing[2],
          }}
        >
          <span>{fr.quotes.ai.fileCardSize(file.size)}</span>
          <span aria-hidden="true">·</span>
          <span data-testid={`ai-file-status-${file.id}`}>{statusLabel}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        data-testid={`ai-file-remove-${file.id}`}
        aria-label={fr.quotes.ai.fileCardRemove}
        style={{
          padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
          border: `${tokens.stroke.hair} solid ${tokens.color.ink}`,
          background: tokens.color.surface,
          color: tokens.color.ink,
          cursor: "pointer",
          fontFamily: tokens.font.ui,
          fontSize: tokens.fontSize.xs,
          fontWeight: Number(tokens.fontWeight.bold),
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {fr.quotes.ai.fileCardRemove}
      </button>
    </div>
  );
}

function RawOutputToggle({
  rawOutput,
  expanded,
  onToggle,
}: {
  rawOutput: string;
  expanded: boolean;
  onToggle: () => void;
}): ReactElement {
  return (
    <section
      data-testid="ai-raw-output"
      style={{
        border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
        background: tokens.color.surface,
        padding: tokens.spacing[4],
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacing[3],
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        data-testid="ai-raw-output-toggle"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
          fontFamily: tokens.font.ui,
          fontSize: tokens.fontSize.xs,
          fontWeight: Number(tokens.fontWeight.bold),
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: tokens.color.muted,
          textAlign: "left",
        }}
      >
        {expanded ? fr.quotes.ai.hideRawOutput : fr.quotes.ai.showRawOutput}
      </button>
      {expanded && (
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
            {fr.quotes.ai.rawOutputTitle}
          </div>
          <pre
            data-testid="ai-raw-output-content"
            style={{
              fontFamily: tokens.font.mono,
              fontSize: tokens.fontSize.xs,
              background: tokens.color.paper,
              border: `${tokens.stroke.hair} solid ${tokens.color.line}`,
              padding: tokens.spacing[3],
              margin: 0,
              overflow: "auto",
              maxHeight: 400,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {rawOutput}
          </pre>
        </div>
      )}
    </section>
  );
}

interface ExtractedEditorProps {
  extracted: Partial<ExtractedQuote>;
  onApply: (final: ExtractedQuote) => void;
}

const UNIT_OPTIONS: ReadonlyArray<{ value: ExtractedUnit; label: string }> = [
  { value: "forfait", label: "Forfait" },
  { value: "hour", label: "Heure" },
  { value: "day", label: "Jour" },
  { value: "unit", label: "Unité" },
];

function ExtractedEditor({ extracted, onApply }: ExtractedEditorProps): ReactElement {
  const [clientName, setClientName] = useState<string>(extracted.client?.name ?? "");
  const [clientEmail, setClientEmail] = useState<string>(extracted.client?.email ?? "");
  const [items, setItems] = useState<ExtractedQuoteItem[]>(() =>
    (extracted.items ?? []).map((it) => ({
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      unit: it.unit,
    }))
  );
  const [notes, setNotes] = useState<string>(extracted.notes ?? "");

  // Si l'extracted change (ex. nouveau stream), on ré-initialise.
  useEffect(() => {
    setClientName(extracted.client?.name ?? "");
    setClientEmail(extracted.client?.email ?? "");
    setItems(
      (extracted.items ?? []).map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        unit: it.unit,
      }))
    );
    setNotes(extracted.notes ?? "");
  }, [extracted]);

  const total = useMemo<number>(
    () => items.reduce((s, it) => s + (it.quantity || 0) * (it.unitPrice || 0), 0),
    [items]
  );

  function updateItem(idx: number, patch: Partial<ExtractedQuoteItem>): void {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function removeItem(idx: number): void {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function addItem(): void {
    setItems((prev) => [
      ...prev,
      { description: "", quantity: 1, unitPrice: 0, unit: "forfait" },
    ]);
  }

  const canApply = clientName.trim().length > 0 && items.length > 0;

  function handleApplyClick(): void {
    onApply({
      client: {
        name: clientName.trim(),
        ...(clientEmail.trim().length > 0 ? { email: clientEmail.trim() } : {}),
      },
      items: items.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        unit: it.unit,
      })),
      ...(notes.trim().length > 0 ? { notes: notes.trim() } : {}),
      ...(extracted.validUntil ? { validUntil: extracted.validUntil } : {}),
      ...(extracted.depositPercent !== undefined
        ? { depositPercent: extracted.depositPercent }
        : {}),
    });
  }

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
          display: "flex",
          flexDirection: "column",
          gap: tokens.spacing[1],
        }}
      >
        <div
          style={{
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
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.xs,
            color: tokens.color.ink,
            opacity: 0.8,
          }}
        >
          {fr.quotes.ai.extractedSubtitle}
        </div>
      </div>

      <div
        style={{
          padding: tokens.spacing[5],
          display: "flex",
          flexDirection: "column",
          gap: tokens.spacing[4],
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: tokens.spacing[3],
          }}
        >
          <Input
            label={fr.quotes.ai.extractedClientName}
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            data-testid="ai-edit-client-name"
            required
          />
          <Input
            label={fr.quotes.ai.extractedClientEmail}
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            data-testid="ai-edit-client-email"
            type="email"
          />
        </div>

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
          {items.length === 0 ? (
            <div
              data-testid="ai-no-items-hint"
              role="status"
              style={{
                border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
                background: tokens.color.warnBg,
                padding: tokens.spacing[3],
                fontFamily: tokens.font.ui,
                fontSize: tokens.fontSize.sm,
                color: tokens.color.ink,
              }}
            >
              {fr.quotes.ai.noItemsHint}
            </div>
          ) : (
            <ul
              data-testid="ai-edit-items"
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: tokens.spacing[2],
              }}
            >
              {items.map((it, idx) => (
                <li
                  key={idx}
                  data-testid={`ai-edit-item-${idx}`}
                  style={{
                    border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
                    padding: tokens.spacing[3],
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 2fr) 80px 110px 110px auto",
                    gap: tokens.spacing[2],
                    alignItems: "end",
                  }}
                >
                  <Input
                    label={fr.quotes.ai.extractedItemDescription}
                    value={it.description}
                    onChange={(e) => updateItem(idx, { description: e.target.value })}
                    data-testid={`ai-edit-item-${idx}-desc`}
                  />
                  <Input
                    label={fr.quotes.ai.extractedItemQuantity}
                    type="number"
                    min={0}
                    step={0.5}
                    value={it.quantity}
                    onChange={(e) =>
                      updateItem(idx, { quantity: Number(e.target.value) || 0 })
                    }
                    data-testid={`ai-edit-item-${idx}-qty`}
                  />
                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: tokens.spacing[1],
                      fontFamily: tokens.font.ui,
                      fontSize: tokens.fontSize.xs,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: Number(tokens.fontWeight.bold),
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: tokens.color.muted,
                      }}
                    >
                      {fr.quotes.ai.extractedItemUnit}
                    </span>
                    <select
                      value={it.unit}
                      onChange={(e) =>
                        updateItem(idx, { unit: e.target.value as ExtractedUnit })
                      }
                      data-testid={`ai-edit-item-${idx}-unit`}
                      style={{
                        height: 36,
                        padding: `0 ${tokens.spacing[2]}`,
                        border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
                        background: tokens.color.surface,
                        fontFamily: tokens.font.ui,
                        fontSize: tokens.fontSize.sm,
                        fontWeight: Number(tokens.fontWeight.med),
                      }}
                    >
                      {UNIT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Input
                    label={fr.quotes.ai.extractedItemPrice}
                    type="number"
                    min={0}
                    step={1}
                    value={it.unitPrice}
                    onChange={(e) =>
                      updateItem(idx, { unitPrice: Number(e.target.value) || 0 })
                    }
                    data-testid={`ai-edit-item-${idx}-price`}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    data-testid={`ai-edit-item-${idx}-remove`}
                    aria-label={fr.quotes.ai.extractedItemRemove}
                    style={{
                      height: 36,
                      padding: `0 ${tokens.spacing[2]}`,
                      border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
                      background: tokens.color.surface,
                      cursor: "pointer",
                      fontFamily: tokens.font.ui,
                      fontWeight: Number(tokens.fontWeight.bold),
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      fontSize: tokens.fontSize.xs,
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div style={{ marginTop: tokens.spacing[2] }}>
            <Button variant="secondary" onClick={addItem} data-testid="ai-edit-item-add">
              {fr.quotes.ai.extractedItemAdd}
            </Button>
          </div>
        </div>

        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: tokens.spacing[1],
            fontFamily: tokens.font.ui,
          }}
        >
          <span
            style={{
              fontSize: tokens.fontSize.xs,
              fontWeight: Number(tokens.fontWeight.bold),
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: tokens.color.muted,
            }}
          >
            {fr.quotes.ai.extractedNotes}
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={fr.quotes.ai.extractedNotesPlaceholder}
            rows={3}
            data-testid="ai-edit-notes"
            style={{
              padding: tokens.spacing[2],
              border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
              background: tokens.color.surface,
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.sm,
              resize: "vertical",
            }}
          />
        </label>

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
            onClick={handleApplyClick}
            data-testid="ai-apply"
            disabled={!canApply}
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
          <Button
            variant="primary"
            onClick={() => void navigate("/settings")}
            data-testid="quote-new-ai-cli-go-settings"
          >
            {fr.quotes.ai.goSettings}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              onFallback();
              void navigate("/quotes/new?mode=manual");
            }}
            data-testid="quote-new-ai-cli-go-manual"
          >
            {fr.quotes.ai.goManual}
          </Button>
        </div>
      </div>
    </div>
  );
}
