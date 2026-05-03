import { tokens } from "@fakt/design-tokens";
import { fr } from "@fakt/shared";
import type { SignatureEvent } from "@fakt/shared";
import { Button, Checkbox, Modal, SegmentedControl, toast } from "@fakt/ui";
import type { ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { signatureApi } from "../../features/doc-editor/signature-api.js";
import { isWeb } from "../../utils/runtime.js";
import { SignatureCanvas, type SignatureCanvasHandle } from "./SignatureCanvas.js";
import { TypeSignature, type TypeSignatureHandle } from "./TypeSignature.js";
import { validateSignatureSubmit } from "./schema.js";

/**
 * Détecte si l'OS est macOS — on utilise userAgent (compatible Tauri webview)
 * plutôt que `navigator.platform` qui est déprécié. SSR-safe via guard typeof.
 */
function isMacOs(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/i.test(navigator.userAgent);
}

export type SignableDocType = "quote" | "invoice";

export interface SignatureModalProps {
  open: boolean;
  onClose: () => void;
  docId: string;
  docType: SignableDocType;
  docNumber: string | null;
  clientName: string;
  signerName: string;
  signerEmail: string;
  pdfBytes: Uint8Array | null;
  /**
   * Optionnel : callback qui regénère le PDF avec la signature manuscrite
   * incrustée visuellement (Typst `image()`) avant que la couche PAdES B-T
   * ne soit appliquée. L'ordre est strict — modifier le PDF après PAdES
   * casserait l'intégrité crypto. Si absent, on signe `pdfBytes` tel quel.
   */
  renderPdfWithSignature?: (signaturePng: Uint8Array) => Promise<Uint8Array>;
  onSigned: (event: SignatureEvent, signedPdf: Uint8Array) => void | Promise<void>;
}

type SubmitState = "idle" | "preparing" | "signing" | "success" | "error";

export function SignatureModal({
  open,
  onClose,
  docId,
  docType,
  docNumber,
  clientName,
  signerName,
  signerEmail,
  pdfBytes,
  renderPdfWithSignature,
  onSigned,
}: SignatureModalProps): ReactElement {
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [ack, setAck] = useState(false);
  // Détection macOS au mount : si l'utilisateur est sur Mac et qu'il dessine
  // au trackpad, on remplace le canvas Brutal par un look fidèle au panneau
  // de signature natif macOS (charcoal + trait blanc + placeholder centré).
  const macTrackpadVariant = useMemo(() => isMacOs(), []);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const navigate = useNavigate();
  const drawRef = useRef<SignatureCanvasHandle | null>(null);
  const typeRef = useRef<TypeSignatureHandle | null>(null);

  useEffect(() => {
    if (!open) {
      setAck(false);
      setSubmitState("idle");
      setErrorMessage(null);
      setFieldError(null);
      setMode("draw");
    }
  }, [open]);

  // Mode web : la signature PAdES nécessite la clé privée X.509 du keychain OS,
  // donc 100% desktop. On affiche une modal informative à la place.
  if (open && isWeb()) {
    return (
      <Modal
        open={open}
        title={fr.signature.modal.webUnavailableTitle}
        onClose={onClose}
        size="md"
        footer={
          <Button variant="primary" onClick={onClose} data-testid="signature-modal-web-close">
            {fr.shortcuts.close}
          </Button>
        }
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: tokens.spacing[3],
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.sm,
            color: tokens.color.ink,
            lineHeight: 1.5,
          }}
          data-testid="signature-modal-web-unavailable"
        >
          <p style={{ margin: 0 }}>{fr.signature.modal.webUnavailableBody}</p>
          <p style={{ margin: 0, color: tokens.color.muted }}>
            {fr.signature.modal.webUnavailableHint}
          </p>
        </div>
      </Modal>
    );
  }

  const title = useMemo((): string => {
    const label = `${docNumber ?? fr.quotes.labels.numberPending} — ${clientName}`;
    return docType === "quote"
      ? fr.signature.modal.titleQuote(label)
      : fr.signature.modal.titleInvoice(label);
  }, [docNumber, clientName, docType]);

  const submitting = submitState === "preparing" || submitState === "signing";

  async function getSignaturePng(): Promise<Uint8Array> {
    if (mode === "draw") {
      if (drawRef.current && !drawRef.current.isEmpty()) {
        return drawRef.current.toPngBytes();
      }
      return new Uint8Array();
    }
    if (typeRef.current && !typeRef.current.isEmpty()) {
      return typeRef.current.toPngBytes();
    }
    return new Uint8Array();
  }

  async function handleSubmit(): Promise<void> {
    setFieldError(null);
    setErrorMessage(null);

    if (!pdfBytes || pdfBytes.byteLength === 0) {
      setFieldError(fr.signature.modal.pdfNotReady);
      return;
    }

    const png = await getSignaturePng();
    if (png.byteLength === 0) {
      setFieldError(fr.signature.modal.emptySignature);
      return;
    }

    const parsed = validateSignatureSubmit({
      docId,
      docType,
      mode,
      signaturePng: png,
      ack,
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setFieldError(first?.message ?? fr.signature.modal.ackRequired);
      return;
    }

    setSubmitState("preparing");
    try {
      const events = await signatureApi.listEvents(docType, docId);
      const previous = events.length > 0 ? events[events.length - 1] : null;
      // Si l'appelant fournit un re-rendu, on regénère le PDF avec la signature
      // visuelle incrustée AVANT le scellement PAdES. Toute modification du
      // PDF après PAdES casserait l'intégrité crypto.
      const pdfToSign = renderPdfWithSignature ? await renderPdfWithSignature(png) : pdfBytes;
      setSubmitState("signing");
      const result = await signatureApi.sign({
        docId,
        docType,
        signerName,
        signerEmail,
        pdfBytes: pdfToSign,
        signaturePng: png,
        previousEvent: previous ?? null,
      });
      await signatureApi.appendEvent(result.signatureEvent);
      try {
        await signatureApi.storeSignedPdf(docType, docId, result.signedPdf);
      } catch (err) {
        // Non bloquant : certains environnements n'ont pas encore de storage.
        // eslint-disable-next-line no-console
        console.warn("storeSignedPdf failed (non-blocking):", err);
      }
      setSubmitState("success");
      toast.success(fr.signature.modal.successTitle);
      await onSigned(result.signatureEvent, result.signedPdf);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/cert/i.test(msg) && /(absent|not.?found|missing)/i.test(msg)) {
        setSubmitState("error");
        setErrorMessage(fr.signature.modal.certMissingBody);
        return;
      }
      setSubmitState("error");
      setErrorMessage(fr.signature.modal.errorBody(msg));
    }
  }

  function handleClear(): void {
    if (mode === "draw") drawRef.current?.clear();
    else typeRef.current?.clear();
    setFieldError(null);
  }

  function handleCertMissingNav(): void {
    onClose();
    navigate("/settings#certificate");
  }

  return (
    <Modal
      open={open}
      title={title}
      {...(!submitting ? { onClose } : {})}
      size="lg"
      footer={
        <>
          <span
            aria-hidden
            style={{
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.xs,
              fontWeight: Number(tokens.fontWeight.bold),
              textTransform: "uppercase",
              color: tokens.color.muted,
              marginRight: "auto",
            }}
          >
            {fr.signature.modal.level} : {fr.signature.modal.levelValue}
          </span>
          <Button
            variant="ghost"
            onClick={handleClear}
            disabled={submitting}
            data-testid="signature-modal-clear"
          >
            {fr.signature.modal.clear}
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
            data-testid="signature-modal-cancel"
          >
            {fr.signature.modal.cancel}
          </Button>
          <Button
            variant="primary"
            onClick={(): void => {
              void handleSubmit();
            }}
            disabled={submitting || !ack}
            data-testid="signature-modal-submit"
          >
            {submitting
              ? submitState === "signing"
                ? fr.signature.modal.submittingTsa
                : fr.signature.modal.submitting
              : fr.signature.modal.submit}
          </Button>
        </>
      }
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: tokens.spacing[4],
        }}
      >
        <SegmentedControl
          options={[
            { value: "draw", label: fr.signature.modal.tabDraw },
            { value: "type", label: fr.signature.modal.tabType },
          ]}
          value={mode}
          onChange={(v): void => setMode(v === "type" ? "type" : "draw")}
          ariaLabel={fr.signature.title}
        />

        <div
          style={{
            fontFamily: tokens.font.ui,
            fontSize: tokens.fontSize.sm,
            color: tokens.color.ink,
            display: "flex",
            flexDirection: "column",
            gap: tokens.spacing[1],
          }}
        >
          <span>
            {mode === "draw"
              ? fr.signature.modal.drawInstruction
              : fr.signature.modal.typeInstruction}
          </span>
          {mode === "draw" && (
            <span
              style={{
                fontSize: tokens.fontSize.xs,
                color: tokens.color.muted,
                fontFamily: tokens.font.mono,
              }}
            >
              {fr.signature.modal.drawUndoHint}
            </span>
          )}
        </div>

        <div
          data-testid="signature-modal-pane"
          style={{ display: "flex", justifyContent: "center" }}
        >
          {mode === "draw" ? (
            <SignatureCanvas
              ref={drawRef}
              variant={macTrackpadVariant ? "trackpad-mac" : "default"}
            />
          ) : (
            <TypeSignature ref={typeRef} />
          )}
        </div>

        <Checkbox
          checked={ack}
          onChange={(e): void => setAck(e.target.checked)}
          label={fr.signature.modal.ackLabel}
          data-testid="signature-modal-ack"
        />

        {fieldError !== null && (
          <div
            role="alert"
            data-testid="signature-modal-field-error"
            style={{
              border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
              background: tokens.color.dangerBg,
              padding: tokens.spacing[3],
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.sm,
              fontWeight: Number(tokens.fontWeight.bold),
            }}
          >
            {fieldError}
          </div>
        )}

        {errorMessage !== null && (
          <div
            role="alert"
            data-testid="signature-modal-submit-error"
            style={{
              border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
              background: tokens.color.dangerBg,
              padding: tokens.spacing[3],
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.sm,
              fontWeight: Number(tokens.fontWeight.bold),
              display: "flex",
              gap: tokens.spacing[3],
              flexDirection: "column",
            }}
          >
            <strong>{fr.signature.modal.errorTitle}</strong>
            <span>{errorMessage}</span>
            <div style={{ display: "flex", gap: tokens.spacing[2] }}>
              {errorMessage === fr.signature.modal.certMissingBody ? (
                <Button
                  variant="secondary"
                  onClick={handleCertMissingNav}
                  data-testid="signature-modal-cert-cta"
                >
                  {fr.signature.modal.certMissingCta}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={(): void => {
                    void handleSubmit();
                  }}
                  data-testid="signature-modal-retry"
                >
                  {fr.signature.modal.retry}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
