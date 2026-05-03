import { tokens } from "@fakt/design-tokens";
import { fr } from "@fakt/shared";
import { Button, Input, Modal, toast } from "@fakt/ui";
import type { ChangeEvent, ReactElement } from "react";
import { useEffect, useState } from "react";
import {
  commitImportSignedQuote,
  verifyImportedPdfHash,
} from "../../features/doc-editor/import-signed-quote.js";

export interface ImportSignedModalProps {
  open: boolean;
  onClose: () => void;
  quoteId: string;
  /** Hash texte du PDF officiel à l'émission. NULL = feature indisponible. */
  expectedHash: string | null;
  /** Pré-remplit le nom du signataire (typiquement client.name). */
  defaultSignerName?: string | null;
  /** Pré-remplit l'email (typiquement client.email). */
  defaultSignerEmail?: string | null;
  /** Callback déclenché après import réussi (pour refresh du state parent). */
  onImported: () => void;
}

type Phase =
  | { kind: "form" }
  | { kind: "verifying" }
  | {
      kind: "mismatch";
      pdfBytes: Uint8Array;
      expectedHash: string;
      actualHash: string;
      signerName: string;
      signerEmail: string;
    }
  | { kind: "committing" };

function truncateHash(hex: string): string {
  return hex.length <= 16 ? hex : `${hex.slice(0, 8)}…${hex.slice(-8)}`;
}

export function ImportSignedModal({
  open,
  onClose,
  quoteId,
  expectedHash,
  defaultSignerName,
  defaultSignerEmail,
  onImported,
}: ImportSignedModalProps): ReactElement {
  const [signerName, setSignerName] = useState(defaultSignerName ?? "");
  const [signerEmail, setSignerEmail] = useState(defaultSignerEmail ?? "");
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const [error, setError] = useState<string | null>(null);

  // Reset à chaque ouverture pour éviter de garder un état stale.
  useEffect(() => {
    if (open) {
      setSignerName(defaultSignerName ?? "");
      setSignerEmail(defaultSignerEmail ?? "");
      setPdfBytes(null);
      setPdfFileName(null);
      setPhase({ kind: "form" });
      setError(null);
    }
  }, [open, defaultSignerName, defaultSignerEmail]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPdfFileName(file.name);
    file
      .arrayBuffer()
      .then((buf) => setPdfBytes(new Uint8Array(buf)))
      .catch(() => setError(fr.quotes.form.importSigned.errors.generic));
  }

  async function handleVerify(): Promise<void> {
    setError(null);
    if (!pdfBytes) {
      setError(fr.quotes.form.importSigned.errors.noFile);
      return;
    }
    if (!signerEmail.trim()) {
      setError(fr.quotes.form.importSigned.errors.missingEmail);
      return;
    }
    if (!expectedHash) {
      setError(fr.quotes.form.importSigned.errors.noOriginalHash);
      return;
    }
    setPhase({ kind: "verifying" });
    try {
      const result = await verifyImportedPdfHash({ pdfBytes, expectedHash });
      if (result.kind === "match") {
        await commit({
          pdfBytes,
          expectedHash,
          actualHash: result.actualHash,
          signerName: signerName.trim() || "Client",
          signerEmail: signerEmail.trim(),
        });
      } else {
        setPhase({
          kind: "mismatch",
          pdfBytes,
          expectedHash,
          actualHash: result.actualHash,
          signerName: signerName.trim() || "Client",
          signerEmail: signerEmail.trim(),
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`${fr.quotes.form.importSigned.errors.extractFailed} — ${msg}`);
      setPhase({ kind: "form" });
    }
  }

  async function commit(args: {
    pdfBytes: Uint8Array;
    expectedHash: string;
    actualHash: string;
    signerName: string;
    signerEmail: string;
  }): Promise<void> {
    setPhase({ kind: "committing" });
    try {
      await commitImportSignedQuote({
        quoteId,
        pdfBytes: args.pdfBytes,
        signerName: args.signerName,
        signerEmail: args.signerEmail,
        expectedHash: args.expectedHash,
        actualHash: args.actualHash,
      });
      toast.success(fr.quotes.form.importSigned.successToast);
      onImported();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`${fr.quotes.form.importSigned.errors.generic} — ${msg}`);
      setPhase({ kind: "form" });
    }
  }

  const submitting = phase.kind === "verifying" || phase.kind === "committing";

  if (phase.kind === "mismatch") {
    return (
      <Modal
        open={open}
        title={fr.quotes.form.importSigned.mismatchTitle}
        onClose={() => {
          if (!submitting) {
            setPhase({ kind: "form" });
          }
        }}
        size="md"
        data-testid="import-signed-mismatch-modal"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setPhase({ kind: "form" })}
              data-testid="import-signed-mismatch-cancel"
            >
              {fr.quotes.form.importSigned.mismatchCancel}
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                void commit({
                  pdfBytes: phase.pdfBytes,
                  expectedHash: phase.expectedHash,
                  actualHash: phase.actualHash,
                  signerName: phase.signerName,
                  signerEmail: phase.signerEmail,
                })
              }
              data-testid="import-signed-mismatch-confirm"
            >
              {fr.quotes.form.importSigned.mismatchConfirm}
            </Button>
          </>
        }
      >
        <p
          style={{
            margin: 0,
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.sm,
            color: tokens.color.ink,
            lineHeight: 1.5,
          }}
        >
          {fr.quotes.form.importSigned.mismatchBody}
        </p>
        <div
          style={{
            marginTop: tokens.spacing[4],
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
            fontFamily: tokens.font.mono,
            fontSize: tokens.fontSize.xs,
            border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
            background: tokens.color.paper2,
            padding: tokens.spacing[4],
          }}
        >
          <span
            style={{
              fontFamily: tokens.font.ui,
              fontWeight: Number(tokens.fontWeight.bold),
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: tokens.color.muted,
              fontSize: tokens.fontSize.xs,
            }}
          >
            {fr.quotes.form.importSigned.mismatchHashExpected}
          </span>
          <span title={phase.expectedHash} data-testid="import-signed-hash-expected">
            {truncateHash(phase.expectedHash)}
          </span>
          <span
            style={{
              fontFamily: tokens.font.ui,
              fontWeight: Number(tokens.fontWeight.bold),
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: tokens.color.muted,
              fontSize: tokens.fontSize.xs,
            }}
          >
            {fr.quotes.form.importSigned.mismatchHashActual}
          </span>
          <span title={phase.actualHash} data-testid="import-signed-hash-actual">
            {truncateHash(phase.actualHash)}
          </span>
        </div>
        {error && (
          <div
            role="alert"
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
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      title={fr.quotes.form.importSigned.title}
      onClose={() => {
        if (!submitting) onClose();
      }}
      size="md"
      data-testid="import-signed-modal"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
            data-testid="import-signed-cancel"
          >
            {fr.quotes.actions.cancel}
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleVerify()}
            disabled={submitting || !pdfBytes || expectedHash === null}
            data-testid="import-signed-submit"
          >
            {fr.quotes.form.importSigned.submit}
          </Button>
        </>
      }
    >
      <p
        style={{
          margin: 0,
          fontFamily: tokens.font.ui,
          fontSize: tokens.fontSize.sm,
          color: tokens.color.ink,
          lineHeight: 1.5,
        }}
      >
        {fr.quotes.form.importSigned.description}
      </p>

      {expectedHash === null && (
        <div
          role="alert"
          data-testid="import-signed-no-hash"
          style={{
            marginTop: tokens.spacing[3],
            border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
            background: tokens.color.warnBg,
            padding: tokens.spacing[3],
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.sm,
            fontWeight: Number(tokens.fontWeight.bold),
          }}
        >
          {fr.quotes.form.importSigned.errors.noOriginalHash}
        </div>
      )}

      <div
        style={{
          marginTop: tokens.spacing[4],
          display: "flex",
          flexDirection: "column",
          gap: tokens.spacing[3],
        }}
      >
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            gap: tokens.spacing[2],
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.xs,
            fontWeight: Number(tokens.fontWeight.bold),
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: tokens.color.ink,
          }}
        >
          {fr.quotes.form.importSigned.filePickerLabel}
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFileChange}
            disabled={submitting || expectedHash === null}
            data-testid="import-signed-file"
            style={{
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.sm,
              padding: tokens.spacing[2],
              border: `${tokens.stroke.base} solid ${tokens.color.ink}`,
              background: tokens.color.surface,
            }}
          />
          {pdfFileName && (
            <span
              style={{
                fontFamily: tokens.font.mono,
                fontSize: tokens.fontSize.xs,
                color: tokens.color.muted,
                fontWeight: Number(tokens.fontWeight.reg),
                textTransform: "none",
                letterSpacing: 0,
              }}
              data-testid="import-signed-file-name"
            >
              {pdfFileName}
            </span>
          )}
        </label>

        <Input
          label={fr.quotes.form.importSigned.signerNameLabel}
          placeholder={fr.quotes.form.importSigned.signerNamePlaceholder}
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          disabled={submitting}
          data-testid="import-signed-signer-name"
        />
        <Input
          label={fr.quotes.form.importSigned.signerEmailLabel}
          placeholder={fr.quotes.form.importSigned.signerEmailPlaceholder}
          type="email"
          value={signerEmail}
          onChange={(e) => setSignerEmail(e.target.value)}
          disabled={submitting}
          data-testid="import-signed-signer-email"
        />
      </div>

      {error && (
        <div
          role="alert"
          data-testid="import-signed-error"
          style={{
            marginTop: tokens.spacing[3],
            border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
            background: tokens.color.dangerBg,
            padding: tokens.spacing[3],
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.sm,
            fontWeight: Number(tokens.fontWeight.bold),
          }}
        >
          {error}
        </div>
      )}
    </Modal>
  );
}
