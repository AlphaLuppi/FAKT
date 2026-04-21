/**
 * Bridge IPC Tauri pour la signature PAdES B-T et l'audit trail.
 *
 * Le bridge expose des méthodes haut niveau consommées par SignatureModal,
 * AuditTimeline et la route Verify. Les appels Tauri sont centralisés ici ;
 * les tests injectent un double via setSignatureApi.
 */

import { invoke } from "@tauri-apps/api/core";
import type { SignatureEvent, UUID } from "@fakt/shared";

export interface SignDocumentInput {
  docId: UUID;
  docType: "quote" | "invoice";
  signerName: string;
  signerEmail: string;
  pdfBytes: Uint8Array;
  signaturePng: Uint8Array;
  previousEvent?: SignatureEvent | null;
  skipTsa?: boolean;
}

export interface SignDocumentOutput {
  signedPdf: Uint8Array;
  signatureEvent: SignatureEvent;
  tsaProviderUsed: string | null;
  padesLevel: "B" | "B-T";
}

export interface VerifyReport {
  eventId: UUID;
  documentType: "quote" | "invoice";
  documentId: UUID;
  integrityOk: boolean;
  chainOk: boolean;
  chainLength: number;
  brokenChainIndices: number[];
  docHashBefore: string;
  docHashAfter: string;
  tsaProvider: string | null;
  signerName: string;
  signerEmail: string;
  timestampIso: string;
  padesLevel: "B" | "B-T";
}

export interface SignatureApi {
  sign(input: SignDocumentInput): Promise<SignDocumentOutput>;
  listEvents(
    docType: "quote" | "invoice",
    docId: UUID,
  ): Promise<SignatureEvent[]>;
  verify(docId: UUID, eventId: UUID): Promise<VerifyReport>;
  appendEvent(event: SignatureEvent): Promise<void>;
  storeSignedPdf(
    docType: "quote" | "invoice",
    docId: UUID,
    bytes: Uint8Array,
  ): Promise<string>;
  getSignedPdf(
    docType: "quote" | "invoice",
    docId: UUID,
  ): Promise<Uint8Array | null>;
}

interface RustSignatureEvent {
  id: string;
  document_type: "quote" | "invoice";
  document_id: string;
  signer_name: string;
  signer_email: string;
  ip_address: string | null;
  user_agent: string | null;
  timestamp_iso: string;
  doc_hash_before: string;
  doc_hash_after: string;
  signature_png_base64: string | null;
  tsa_provider: string | null;
  tsa_response_base64: string | null;
  previous_event_hash: string | null;
}

type TauriSignResult = {
  signed_pdf: number[];
  signature_event: RustSignatureEvent;
  tsa_provider_used: string | null;
  pades_level: "B" | "B-T";
};

function rustEventToTs(ev: RustSignatureEvent): SignatureEvent {
  const ts = Date.parse(ev.timestamp_iso);
  return {
    id: ev.id,
    documentType: ev.document_type,
    documentId: ev.document_id,
    signerName: ev.signer_name,
    signerEmail: ev.signer_email,
    ipAddress: ev.ip_address,
    userAgent: ev.user_agent,
    timestamp: Number.isNaN(ts) ? Date.now() : ts,
    docHashBefore: ev.doc_hash_before,
    docHashAfter: ev.doc_hash_after,
    signaturePngBase64: ev.signature_png_base64 ?? "",
    previousEventHash: ev.previous_event_hash,
    tsaResponse: ev.tsa_response_base64,
    tsaProvider: ev.tsa_provider,
  };
}

function tsEventToRust(ev: SignatureEvent): RustSignatureEvent {
  return {
    id: ev.id,
    document_type: ev.documentType,
    document_id: ev.documentId,
    signer_name: ev.signerName,
    signer_email: ev.signerEmail,
    ip_address: ev.ipAddress,
    user_agent: ev.userAgent,
    timestamp_iso: new Date(ev.timestamp).toISOString().replace(/\.\d{3}Z$/, "Z"),
    doc_hash_before: ev.docHashBefore,
    doc_hash_after: ev.docHashAfter,
    signature_png_base64:
      ev.signaturePngBase64 !== "" ? ev.signaturePngBase64 : null,
    tsa_provider: ev.tsaProvider,
    tsa_response_base64: ev.tsaResponse,
    previous_event_hash: ev.previousEventHash,
  };
}

const tauriSignatureApi: SignatureApi = {
  async sign(input): Promise<SignDocumentOutput> {
    const result = await invoke<TauriSignResult>("sign_document", {
      args: {
        doc_id: input.docId,
        doc_type: input.docType,
        signer_name: input.signerName,
        signer_email: input.signerEmail,
        pdf_bytes: Array.from(input.pdfBytes),
        signature_png: Array.from(input.signaturePng),
        previous_event: input.previousEvent ?? null,
        skip_tsa: input.skipTsa ?? false,
      },
    });
    return {
      signedPdf: new Uint8Array(result.signed_pdf),
      signatureEvent: rustEventToTs(result.signature_event),
      tsaProviderUsed: result.tsa_provider_used,
      padesLevel: result.pades_level,
    };
  },
  async listEvents(docType, docId): Promise<SignatureEvent[]> {
    const rows = await invoke<RustSignatureEvent[]>("get_signature_events", {
      docType,
      docId,
    });
    return rows.map(rustEventToTs);
  },
  async verify(docId, eventId): Promise<VerifyReport> {
    return invoke<VerifyReport>("verify_signature", { docId, eventId });
  },
  async appendEvent(event): Promise<void> {
    await invoke<void>("append_signature_event", {
      event: tsEventToRust(event),
    });
  },
  async storeSignedPdf(docType, docId, bytes): Promise<string> {
    return invoke<string>("store_signed_pdf", {
      docType,
      docId,
      bytes: Array.from(bytes),
    });
  },
  async getSignedPdf(docType, docId): Promise<Uint8Array | null> {
    const res = await invoke<number[] | null>("get_signed_pdf", {
      docType,
      docId,
    });
    return res ? new Uint8Array(res) : null;
  },
};

let _impl: SignatureApi = tauriSignatureApi;

export const signatureApi: SignatureApi = {
  sign: (input) => _impl.sign(input),
  listEvents: (docType, docId) => _impl.listEvents(docType, docId),
  verify: (docId, eventId) => _impl.verify(docId, eventId),
  appendEvent: (event) => _impl.appendEvent(event),
  storeSignedPdf: (docType, docId, bytes) =>
    _impl.storeSignedPdf(docType, docId, bytes),
  getSignedPdf: (docType, docId) => _impl.getSignedPdf(docType, docId),
};

/** Injection pour tests. Passer `null` pour restaurer Tauri. */
export function setSignatureApi(api: SignatureApi | null): void {
  _impl = api ?? tauriSignatureApi;
}
