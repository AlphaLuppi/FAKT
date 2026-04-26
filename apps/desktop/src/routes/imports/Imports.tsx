import {
  type ExtractedQuote,
  type ExtractedQuoteItem,
  SUPPORTED_ACCEPT,
  getAi,
  parseFile,
} from "@fakt/ai";
import { tokens } from "@fakt/design-tokens";
import { buildLegalMentionsSnapshot } from "@fakt/legal";
import { fr } from "@fakt/shared";
import type { DocumentUnit, PaymentMethod, UUID } from "@fakt/shared";
import { Button, Dropzone, Input, Textarea } from "@fakt/ui";
import type { ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { invoicesApi } from "../../api/invoices.js";
import { quotesApi } from "../../api/quotes.js";
import { ClientPicker } from "../../features/doc-editor/index.js";
import { useClientsList, useWorkspace } from "../quotes/hooks.js";

type ImportType = "quote" | "invoice";
type SourceMode = "file" | "text";
type FileStatus = "parsing" | "ready" | "error";

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  status: FileStatus;
  text: string;
  error?: string;
}

interface EditableLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unit: ExtractedQuoteItem["unit"];
}

const UNIT_OPTIONS: ReadonlyArray<{ value: EditableLine["unit"]; label: string }> = [
  { value: "forfait", label: "Forfait" },
  { value: "hour", label: "Heure" },
  { value: "day", label: "Jour" },
  { value: "unit", label: "Unité" },
];

function newId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `tmp-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function mapExtractedUnit(u: EditableLine["unit"]): DocumentUnit {
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
  return ["client", "items", "validUntil", "notes"].some((k) => k in obj);
}

function dateInputValue(ms: number | null): string {
  if (ms === null) return "";
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateInput(s: string): number | null {
  if (s.trim().length === 0) return null;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : null;
}

export function ImportsRoute(): ReactElement {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialType = params.get("type") === "invoice" ? "invoice" : "quote";

  const [type, setType] = useState<ImportType>(initialType);
  const [sourceMode, setSourceMode] = useState<SourceMode>("file");
  const [brief, setBrief] = useState<string>("");
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  const [extracted, setExtracted] = useState<Partial<ExtractedQuote> | null>(null);
  const [clientId, setClientId] = useState<UUID | null>(null);
  const [title, setTitle] = useState<string>("");
  const [externalNumber, setExternalNumber] = useState<string>("");
  const [issuedAt, setIssuedAt] = useState<number | null>(null);
  const [signedOrPaidAt, setSignedOrPaidAt] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("wire");
  const [paymentNotes, setPaymentNotes] = useState<string>("");
  const [lines, setLines] = useState<EditableLine[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const parseCancelTokens = useRef<Map<string, () => void>>(new Map());

  const { clients } = useClientsList();
  const { workspace } = useWorkspace();

  const briefForExtract = useMemo<string>(() => {
    if (sourceMode === "text") return brief.trim();
    const ready = files.filter((f) => f.status === "ready" && f.text.trim().length > 0);
    if (ready.length === 0) return "";
    return ready.map((f) => `--- Contenu de ${f.name} ---\n\n${f.text}`).join("\n\n");
  }, [sourceMode, brief, files]);

  const canExtract = briefForExtract.length > 0 && !extracting;
  const filesParsing = files.some((f) => f.status === "parsing");

  const total = useMemo<number>(
    () => lines.reduce((s, l) => s + (l.quantity || 0) * (l.unitPrice || 0), 0),
    [lines]
  );

  // Quand le devis extrait change, pré-remplit les champs.
  useEffect(() => {
    if (!extracted) return;
    if (extracted.client?.name && title.length === 0) {
      setTitle(
        type === "quote"
          ? `Devis — ${extracted.client.name}`
          : `Facture — ${extracted.client.name}`
      );
    }
    if (extracted.items && lines.length === 0) {
      setLines(
        extracted.items.map((it) => ({
          id: newId(),
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          unit: it.unit,
        }))
      );
    }
    // Auto-match client par email si possible
    if (extracted.client?.email && clientId === null) {
      const match = clients.find((c) => c.email === extracted.client?.email);
      if (match) setClientId(match.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extracted, clients]);

  async function handleExtract(): Promise<void> {
    if (!canExtract) return;
    setExtracting(true);
    setExtracted(null);
    setStreamError(null);

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
          }
        } else if (event.type === "done") {
          if (isStructuredQuote(event.data)) {
            setExtracted(event.data);
          } else {
            setStreamError(fr.quotes.ai.extractFailedDetail);
          }
        } else if (event.type === "error") {
          setStreamError(event.message);
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
    setSourceMode("file");

    const newAttached: AttachedFile[] = dropped.map((file) => ({
      id: newId(),
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
              f.id === attached.id ? { ...f, status: "error", error: "Lecture annulée." } : f
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
    parseCancelTokens.current.get(id)?.();
    parseCancelTokens.current.delete(id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function updateLine(idx: number, patch: Partial<EditableLine>): void {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function removeLine(idx: number): void {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function addLine(): void {
    setLines((prev) => [
      ...prev,
      { id: newId(), description: "", quantity: 1, unitPrice: 0, unit: "forfait" },
    ]);
  }

  async function handleSubmit(): Promise<void> {
    setSubmitError(null);
    if (!clientId) {
      setSubmitError(fr.imports.errorClientRequired);
      return;
    }
    if (title.trim().length === 0) {
      setSubmitError(fr.imports.errorTitleRequired);
      return;
    }
    if (lines.length === 0) {
      setSubmitError(fr.imports.errorItemsRequired);
      return;
    }
    setSubmitting(true);
    try {
      const items = lines.map((l, idx) => ({
        id: newId(),
        position: idx,
        description: l.description,
        quantity: Math.round((l.quantity || 1) * 1000),
        unitPriceCents: Math.round((l.unitPrice || 0) * 100),
        unit: mapExtractedUnit(l.unit),
        lineTotalCents: Math.round((l.quantity || 1) * (l.unitPrice || 0) * 100),
        serviceId: null,
      }));
      const totalHtCents = items.reduce((s, it) => s + it.lineTotalCents, 0);

      if (type === "quote") {
        const created = await quotesApi.importExisting({
          id: newId(),
          clientId,
          externalNumber: externalNumber.trim().length > 0 ? externalNumber.trim() : null,
          title: title.trim(),
          totalHtCents,
          issuedAt,
          signedAt: signedOrPaidAt,
          status: signedOrPaidAt ? "signed" : "sent",
          notes: extracted?.notes ?? null,
          items,
        });
        navigate(`/quotes/${created.id}`);
      } else {
        const legalMentions = workspace
          ? buildLegalMentionsSnapshot(
              {
                name: workspace.name,
                legalForm: workspace.legalForm,
                siret: workspace.siret,
                address: workspace.address,
                iban: workspace.iban,
                tvaMention: workspace.tvaMention,
              },
              30
            )
          : "";
        const created = await invoicesApi.importExisting({
          id: newId(),
          clientId,
          externalNumber: externalNumber.trim().length > 0 ? externalNumber.trim() : null,
          title: title.trim(),
          totalHtCents,
          issuedAt,
          paidAt: signedOrPaidAt,
          paymentMethod,
          paymentNotes: paymentNotes.trim().length > 0 ? paymentNotes.trim() : null,
          status: signedOrPaidAt ? "paid" : "sent",
          legalMentions,
          items,
        });
        navigate(`/invoices/${created.id}`);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : fr.imports.errorSubmit);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        padding: tokens.spacing[6],
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacing[5],
        maxWidth: 1000,
        margin: "0 auto",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
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
            {fr.imports.title}
          </h1>
          <p
            style={{
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.sm,
              color: tokens.color.muted,
              marginTop: tokens.spacing[1],
              marginBottom: 0,
              maxWidth: 720,
            }}
          >
            {fr.imports.subtitle}
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => navigate(type === "quote" ? "/quotes" : "/invoices")}
          data-testid="imports-back"
        >
          {fr.imports.backToList}
        </Button>
      </header>

      <Section testId="imports-type-section">
        <SectionTitle>{fr.imports.typeLabel}</SectionTitle>
        <div
          role="radiogroup"
          aria-label={fr.imports.typeLabel}
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: tokens.spacing[3] }}
        >
          <TypeRadio
            value="quote"
            current={type}
            label={fr.imports.typeQuote}
            hint={fr.imports.typeQuoteHint}
            onChange={setType}
          />
          <TypeRadio
            value="invoice"
            current={type}
            label={fr.imports.typeInvoice}
            hint={fr.imports.typeInvoiceHint}
            onChange={setType}
          />
        </div>
      </Section>

      <Section testId="imports-source-section">
        <SectionTitle>{fr.imports.sourceTitle}</SectionTitle>
        <div
          role="tablist"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
            marginBottom: tokens.spacing[3],
          }}
        >
          <SourceTab
            active={sourceMode === "file"}
            label={fr.imports.sourceTabFile}
            onClick={() => setSourceMode("file")}
            testId="imports-tab-file"
            isFirst
          />
          <SourceTab
            active={sourceMode === "text"}
            label={fr.imports.sourceTabText}
            onClick={() => setSourceMode("text")}
            testId="imports-tab-text"
          />
        </div>

        {sourceMode === "file" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing[3] }}>
            <Dropzone
              onFiles={handleDroppedFiles}
              accept={SUPPORTED_ACCEPT}
              disabled={extracting}
              data-testid="imports-dropzone"
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
                  cursor: extracting ? "not-allowed" : "pointer",
                }}
              >
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
                  style={{
                    fontFamily: tokens.font.ui,
                    fontSize: tokens.fontSize.xs,
                    color: tokens.color.muted,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {fr.imports.sourceFileHint}
                </span>
              </div>
            </Dropzone>

            {files.length > 0 && (
              <ul
                data-testid="imports-file-list"
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: tokens.spacing[2],
                }}
              >
                {files.map((f) => (
                  <li key={f.id}>
                    <FileCard file={f} onRemove={() => handleRemoveFile(f.id)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <Textarea
            label={fr.quotes.ai.briefLabel}
            placeholder={fr.imports.sourceTextHint}
            value={brief}
            rows={8}
            onChange={(e) => setBrief(e.target.value)}
            disabled={extracting}
            data-testid="imports-brief"
          />
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: tokens.spacing[3],
          }}
        >
          {extracting ? (
            <Button variant="danger" onClick={handleCancel} data-testid="imports-cancel">
              {fr.imports.cancel}
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => void handleExtract()}
              disabled={!canExtract || filesParsing}
              data-testid="imports-extract"
            >
              {fr.imports.extract}
            </Button>
          )}
        </div>

        {extracting && (
          <div
            data-testid="imports-extracting"
            style={{
              border: `${tokens.stroke.base} dashed ${tokens.color.ink}`,
              padding: tokens.spacing[4],
              textAlign: "center",
              fontFamily: tokens.font.ui,
              color: tokens.color.muted,
              marginTop: tokens.spacing[3],
            }}
          >
            {fr.imports.extracting}
          </div>
        )}

        {streamError && (
          <div
            role="alert"
            data-testid="imports-stream-error"
            style={{
              border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
              background: tokens.color.dangerBg,
              padding: tokens.spacing[3],
              marginTop: tokens.spacing[3],
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.sm,
            }}
          >
            {streamError}
          </div>
        )}
      </Section>

      <Section testId="imports-fill-section">
        <div>
          <SectionTitle>{fr.imports.fillTitle}</SectionTitle>
          <p
            style={{
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.sm,
              color: tokens.color.muted,
              margin: 0,
            }}
          >
            {fr.imports.fillSubtitle}
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: tokens.spacing[3],
            marginTop: tokens.spacing[3],
          }}
        >
          <Input
            label={fr.imports.titleLabel}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            data-testid="imports-title"
          />
          <Input
            label={fr.imports.externalNumberLabel}
            value={externalNumber}
            onChange={(e) => setExternalNumber(e.target.value)}
            placeholder={fr.imports.externalNumberPlaceholder}
            hint={fr.imports.externalNumberHint}
            data-testid="imports-external-number"
          />
        </div>

        <div style={{ marginTop: tokens.spacing[3] }}>
          <span
            style={{
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.xs,
              fontWeight: Number(tokens.fontWeight.bold),
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: tokens.color.muted,
              display: "block",
              marginBottom: tokens.spacing[1],
            }}
          >
            {fr.imports.clientLabel}
          </span>
          <ClientPicker value={clientId} onChange={setClientId} clients={clients} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: tokens.spacing[3],
            marginTop: tokens.spacing[3],
          }}
        >
          <Input
            label={fr.imports.issuedAtLabel}
            type="date"
            value={dateInputValue(issuedAt)}
            onChange={(e) => setIssuedAt(parseDateInput(e.target.value))}
            data-testid="imports-issued-at"
          />
          <Input
            label={type === "quote" ? fr.imports.signedAtLabel : fr.imports.paidAtLabel}
            type="date"
            value={dateInputValue(signedOrPaidAt)}
            onChange={(e) => setSignedOrPaidAt(parseDateInput(e.target.value))}
            data-testid="imports-completion-at"
          />
        </div>

        {type === "invoice" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "200px 1fr",
              gap: tokens.spacing[3],
              marginTop: tokens.spacing[3],
            }}
          >
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
                  color: tokens.color.ink,
                }}
              >
                {fr.imports.paymentMethodLabel}
              </span>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                data-testid="imports-payment-method"
                style={{
                  height: 40,
                  padding: `0 ${tokens.spacing[2]}`,
                  border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
                  background: tokens.color.surface,
                  fontFamily: tokens.font.ui,
                  fontSize: tokens.fontSize.sm,
                }}
              >
                <option value="wire">{fr.imports.paymentMethodWire}</option>
                <option value="check">{fr.imports.paymentMethodCheck}</option>
                <option value="cash">{fr.imports.paymentMethodCash}</option>
                <option value="other">{fr.imports.paymentMethodOther}</option>
              </select>
            </label>
            <Input
              label={fr.imports.paymentNotesLabel}
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              data-testid="imports-payment-notes"
            />
          </div>
        )}

        <LinesEditor
          lines={lines}
          onUpdate={updateLine}
          onRemove={removeLine}
          onAdd={addLine}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `${tokens.stroke.base} solid ${tokens.color.ink}`,
            paddingTop: tokens.spacing[3],
            marginTop: tokens.spacing[3],
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
            Total HT
          </span>
          <span
            style={{
              fontFamily: tokens.font.mono,
              fontSize: tokens.fontSize.lg,
              fontWeight: Number(tokens.fontWeight.black),
              fontVariantNumeric: "tabular-nums",
            }}
            data-testid="imports-total"
          >
            {(total).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
          </span>
        </div>

        <p
          style={{
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.xs,
            color: tokens.color.muted,
            background: tokens.color.warnBg,
            border: `${tokens.stroke.hair} solid ${tokens.color.ink}`,
            padding: tokens.spacing[3],
            marginTop: tokens.spacing[3],
          }}
        >
          ⚠ {fr.imports.legalNotice}
        </p>

        {submitError && (
          <div
            role="alert"
            data-testid="imports-submit-error"
            style={{
              border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
              background: tokens.color.dangerBg,
              padding: tokens.spacing[3],
              marginTop: tokens.spacing[3],
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.sm,
              fontWeight: Number(tokens.fontWeight.bold),
            }}
          >
            {submitError}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: tokens.spacing[3],
          }}
        >
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={submitting || !clientId || lines.length === 0}
            data-testid="imports-submit"
          >
            {submitting
              ? fr.imports.extracting
              : type === "quote"
                ? fr.imports.submitQuote
                : fr.imports.submitInvoice}
          </Button>
        </div>
      </Section>
    </div>
  );
}

interface SectionProps {
  children: React.ReactNode;
  testId?: string;
}

function Section({ children, testId }: SectionProps): ReactElement {
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
      {children}
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }): ReactElement {
  return (
    <h2
      style={{
        font: `${tokens.fontWeight.black} ${tokens.fontSize.md}/1 ${tokens.font.ui}`,
        textTransform: "uppercase",
        letterSpacing: "-0.01em",
        margin: 0,
      }}
    >
      {children}
    </h2>
  );
}

interface TypeRadioProps {
  value: ImportType;
  current: ImportType;
  label: string;
  hint: string;
  onChange: (v: ImportType) => void;
}

function TypeRadio({ value, current, label, hint, onChange }: TypeRadioProps): ReactElement {
  const active = current === value;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => onChange(value)}
      data-testid={`imports-type-${value}`}
      style={{
        textAlign: "left",
        padding: tokens.spacing[3],
        border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
        background: active ? tokens.color.ink : tokens.color.surface,
        color: active ? tokens.color.accentSoft : tokens.color.ink,
        cursor: "pointer",
        boxShadow: active ? "none" : tokens.shadow.sm,
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacing[1],
      }}
    >
      <span
        style={{
          fontFamily: tokens.font.ui,
          fontSize: tokens.fontSize.sm,
          fontWeight: Number(tokens.fontWeight.black),
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: tokens.font.ui,
          fontSize: tokens.fontSize.xs,
          opacity: 0.85,
        }}
      >
        {hint}
      </span>
    </button>
  );
}

interface SourceTabProps {
  active: boolean;
  label: string;
  onClick: () => void;
  testId: string;
  isFirst?: boolean;
}

function SourceTab({ active, label, onClick, testId, isFirst }: SourceTabProps): ReactElement {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      data-testid={testId}
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
      }}
    >
      {label}
    </button>
  );
}

function FileCard({
  file,
  onRemove,
}: {
  file: AttachedFile;
  onRemove: () => void;
}): ReactElement {
  const statusLabel =
    file.status === "parsing"
      ? "Lecture en cours…"
      : file.status === "ready"
        ? "Prêt à analyser"
        : (file.error ?? "Erreur");
  const statusBg =
    file.status === "ready"
      ? tokens.color.accentSoft
      : file.status === "error"
        ? tokens.color.dangerBg
        : tokens.color.paper;
  return (
    <div
      data-testid={`imports-file-card-${file.id}`}
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
          }}
        >
          {(file.size / 1024).toFixed(0)} Ko · {statusLabel}
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        style={{
          padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
          border: `${tokens.stroke.hair} solid ${tokens.color.ink}`,
          background: tokens.color.surface,
          cursor: "pointer",
          fontFamily: tokens.font.ui,
          fontSize: tokens.fontSize.xs,
          fontWeight: Number(tokens.fontWeight.bold),
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        Retirer
      </button>
    </div>
  );
}

interface LinesEditorProps {
  lines: EditableLine[];
  onUpdate: (idx: number, patch: Partial<EditableLine>) => void;
  onRemove: (idx: number) => void;
  onAdd: () => void;
}

function LinesEditor({ lines, onUpdate, onRemove, onAdd }: LinesEditorProps): ReactElement {
  return (
    <div style={{ marginTop: tokens.spacing[4] }}>
      <span
        style={{
          fontFamily: tokens.font.ui,
          fontSize: tokens.fontSize.xs,
          fontWeight: Number(tokens.fontWeight.bold),
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: tokens.color.muted,
          display: "block",
          marginBottom: tokens.spacing[2],
        }}
      >
        Lignes du document
      </span>
      <ul
        data-testid="imports-lines"
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: tokens.spacing[2],
        }}
      >
        {lines.map((l, idx) => (
          <li
            key={l.id}
            data-testid={`imports-line-${idx}`}
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
              label="Description"
              value={l.description}
              onChange={(e) => onUpdate(idx, { description: e.target.value })}
            />
            <Input
              label="Qté"
              type="number"
              min={0}
              step={0.5}
              value={l.quantity}
              onChange={(e) => onUpdate(idx, { quantity: Number(e.target.value) || 0 })}
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
                Unité
              </span>
              <select
                value={l.unit}
                onChange={(e) =>
                  onUpdate(idx, { unit: e.target.value as EditableLine["unit"] })
                }
                style={{
                  height: 36,
                  padding: `0 ${tokens.spacing[2]}`,
                  border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
                  background: tokens.color.surface,
                  fontFamily: tokens.font.ui,
                  fontSize: tokens.fontSize.sm,
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
              label="Prix unitaire (€)"
              type="number"
              min={0}
              step={1}
              value={l.unitPrice}
              onChange={(e) => onUpdate(idx, { unitPrice: Number(e.target.value) || 0 })}
            />
            <button
              type="button"
              onClick={() => onRemove(idx)}
              data-testid={`imports-line-${idx}-remove`}
              style={{
                height: 36,
                padding: `0 ${tokens.spacing[2]}`,
                border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
                background: tokens.color.surface,
                cursor: "pointer",
                fontFamily: tokens.font.ui,
                fontWeight: Number(tokens.fontWeight.bold),
                fontSize: tokens.fontSize.xs,
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: tokens.spacing[2] }}>
        <Button variant="secondary" onClick={onAdd} data-testid="imports-line-add">
          + Ajouter une ligne
        </Button>
      </div>
    </div>
  );
}
