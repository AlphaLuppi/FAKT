/**
 * Bridge signature PAdES B-T + audit trail.
 *
 * Les opérations cryptographiques (sign/verify) restent en commandes Rust
 * via Tauri invoke — c'est là que vivent les clés X.509 et la libsignpdf.
 *
 * Les lectures d'audit (`listEvents`, `appendEvent`) passent par le sidecar
 * Bun+Hono pour factorer l'accès DB. Les PDF signés sont également lus via
 * Rust (accès disque direct, pas DB).
 */

import type { SignatureEvent, UUID } from "@fakt/shared";
import { invoke } from "@tauri-apps/api/core";
import { api as httpApi } from "../../api/index.js";

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
  listEvents(docType: "quote" | "invoice", docId: UUID): Promise<SignatureEvent[]>;
  verify(docId: UUID, eventId: UUID): Promise<VerifyReport>;
  appendEvent(event: SignatureEvent): Promise<void>;
  storeSignedPdf(docType: "quote" | "invoice", docId: UUID, bytes: Uint8Array): Promise<string>;
  getSignedPdf(docType: "quote" | "invoice", docId: UUID): Promise<Uint8Array | null>;
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

const defaultSignatureApi: SignatureApi = {
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
    return httpApi.signatures.listEvents(docType, docId);
  },
  async verify(docId, eventId): Promise<VerifyReport> {
    return invoke<VerifyReport>("verify_signature", { docId, eventId });
  },
  async appendEvent(event): Promise<void> {
    await httpApi.signatures.appendEvent({
      id: event.id,
      documentType: event.documentType,
      documentId: event.documentId,
      signerName: event.signerName,
      signerEmail: event.signerEmail,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      timestamp: event.timestamp,
      docHashBefore: event.docHashBefore,
      docHashAfter: event.docHashAfter,
      signaturePngBase64: event.signaturePngBase64,
      previousEventHash: event.previousEventHash,
      tsaResponse: event.tsaResponse,
      tsaProvider: event.tsaProvider,
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

let _impl: SignatureApi = defaultSignatureApi;

export const signatureApi: SignatureApi = {
  sign: (input) => _impl.sign(input),
  listEvents: (docType, docId) => _impl.listEvents(docType, docId),
  verify: (docId, eventId) => _impl.verify(docId, eventId),
  appendEvent: (event) => _impl.appendEvent(event),
  storeSignedPdf: (docType, docId, bytes) => _impl.storeSignedPdf(docType, docId, bytes),
  getSignedPdf: (docType, docId) => _impl.getSignedPdf(docType, docId),
};

/** Injection pour tests. Passer `null` pour restaurer le défaut (HTTP+invoke). */
export function setSignatureApi(api: SignatureApi | null): void {
  _impl = api ?? defaultSignatureApi;
}
