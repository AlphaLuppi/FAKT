import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { SignatureEvent } from "@fakt/shared";
import {
  setSignatureApi,
  type SignatureApi,
  type SignDocumentOutput,
} from "../../features/doc-editor/signature-api.js";
import { SignatureModal } from "./SignatureModal.js";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";
const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function buildApi(override?: Partial<SignatureApi>): SignatureApi {
  const event: SignatureEvent = {
    id: "evt-1",
    documentType: "quote",
    documentId: VALID_UUID,
    signerName: "Tom",
    signerEmail: "tom@alphaluppi.com",
    ipAddress: null,
    userAgent: null,
    timestamp: Date.now(),
    docHashBefore: "a".repeat(64),
    docHashAfter: "b".repeat(64),
    signaturePngBase64: "iVBOR",
    previousEventHash: null,
    tsaResponse: null,
    tsaProvider: "https://freetsa.org/tsr",
  };
  const output: SignDocumentOutput = {
    signedPdf: new Uint8Array([80, 68, 70]),
    signatureEvent: event,
    tsaProviderUsed: "https://freetsa.org/tsr",
    padesLevel: "B-T",
  };
  return {
    sign: vi.fn(async () => output),
    listEvents: vi.fn(async () => []),
    verify: vi.fn(async () => ({
      eventId: event.id,
      documentType: event.documentType,
      documentId: event.documentId,
      integrityOk: true,
      chainOk: true,
      chainLength: 1,
      brokenChainIndices: [],
      docHashBefore: event.docHashBefore,
      docHashAfter: event.docHashAfter,
      tsaProvider: event.tsaProvider,
      signerName: event.signerName,
      signerEmail: event.signerEmail,
      timestampIso: new Date(event.timestamp).toISOString(),
      padesLevel: "B-T" as const,
    })),
    appendEvent: vi.fn(async () => undefined),
    storeSignedPdf: vi.fn(async () => "/tmp/x.pdf"),
    getSignedPdf: vi.fn(async () => null),
    ...override,
  };
}

beforeAll(() => {
  // jsdom : toBlob + toDataURL
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback): void {
    const blob = new Blob([new Uint8Array(PNG_BYTES)], { type: "image/png" });
    if (typeof (blob as Blob).arrayBuffer !== "function") {
      // jsdom Blob n'a pas arrayBuffer : on en ajoute un stub
      (blob as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer =
        async (): Promise<ArrayBuffer> => {
          const buf = new ArrayBuffer(PNG_BYTES.byteLength);
          new Uint8Array(buf).set(PNG_BYTES);
          return buf;
        };
    }
    cb(blob);
  };
  HTMLCanvasElement.prototype.toDataURL = function (): string {
    // base64 valide (PNG magic bytes)
    return "data:image/png;base64,iVBORw0KGgo=";
  };
});

afterEach(() => {
  setSignatureApi(null);
});

function renderModal(apiOverride?: Partial<SignatureApi>): {
  onSigned: ReturnType<typeof vi.fn>;
  onClose: ReturnType<typeof vi.fn>;
  api: SignatureApi;
} {
  const api = buildApi(apiOverride);
  setSignatureApi(api);
  const onSigned = vi.fn(async () => undefined);
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <SignatureModal
        open={true}
        onClose={onClose}
        docId={VALID_UUID}
        docType="quote"
        docNumber="D2026-001"
        clientName="Atelier Mercier"
        signerName="Tom"
        signerEmail="tom@alphaluppi.com"
        pdfBytes={new Uint8Array([37, 80, 68, 70])}
        onSigned={onSigned}
      />
    </MemoryRouter>,
  );
  return { onSigned, onClose, api };
}

describe("SignatureModal", () => {
  it("affiche les 2 onglets et le niveau AdES-B-T", () => {
    renderModal();
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getAllByText(/AdES-B-T/).length).toBeGreaterThan(0);
  });

  it("refuse l'envoi sans acceptation", async () => {
    renderModal();
    const submit = screen.getByTestId("signature-submit") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it("refuse l'envoi avec signature vide", async () => {
    const { api } = renderModal();
    fireEvent.click(screen.getByTestId("signature-ack"));
    fireEvent.click(screen.getByTestId("signature-submit"));
    await act(async () => {
      await Promise.resolve();
    });
    expect(api.sign).not.toHaveBeenCalled();
    expect(screen.getByTestId("signature-field-error")).toBeInTheDocument();
  });

  it("bascule entre onglets draw et type", () => {
    renderModal();
    const typeTab = screen.getAllByRole("tab")[1];
    if (!typeTab) throw new Error("missing type tab");
    fireEvent.click(typeTab);
    expect(screen.getByTestId("signature-type-input")).toBeInTheDocument();
  });

  it("signe via l'onglet clavier et appelle onSigned", async () => {
    const { api, onSigned, onClose } = renderModal();
    const typeTab = screen.getAllByRole("tab")[1];
    if (!typeTab) throw new Error("missing type tab");
    fireEvent.click(typeTab);
    const input = screen.getByTestId("signature-type-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Tom Andrieu" } });
    fireEvent.click(screen.getByTestId("signature-ack"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("signature-submit"));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(api.sign).toHaveBeenCalledTimes(1);
    expect(api.appendEvent).toHaveBeenCalledTimes(1);
    expect(onSigned).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("affiche une erreur cert manquant et CTA paramètres", async () => {
    const { api } = renderModal({
      sign: vi.fn(async () => {
        throw new Error("cert not found");
      }),
    });
    const typeTab = screen.getAllByRole("tab")[1];
    if (!typeTab) throw new Error("missing type tab");
    fireEvent.click(typeTab);
    fireEvent.change(screen.getByTestId("signature-type-input"), {
      target: { value: "X" },
    });
    fireEvent.click(screen.getByTestId("signature-ack"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("signature-submit"));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(api.sign).toHaveBeenCalled();
    expect(screen.getByTestId("signature-submit-error")).toBeInTheDocument();
    expect(screen.getByTestId("signature-cert-cta")).toBeInTheDocument();
  });
});
