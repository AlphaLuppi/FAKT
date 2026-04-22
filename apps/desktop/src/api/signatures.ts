import type { SignatureEvent } from "@fakt/shared";
import { getApiClient } from "./client.js";

export type DocumentType = "quote" | "invoice";

export interface AppendSignatureEventInput {
  id: string;
  documentType: DocumentType;
  documentId: string;
  signerName: string;
  signerEmail: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  timestamp: number;
  docHashBefore: string;
  docHashAfter: string;
  signaturePngBase64: string;
  previousEventHash?: string | null;
  tsaResponse?: string | null;
  tsaProvider?: string | null;
}

export interface SignedDocumentMeta {
  documentType: DocumentType;
  documentId: string;
  path: string;
  padesLevel: "B" | "B-T";
  tsaProvider: string | null;
  signedAt: number;
  signatureEventId: string;
}

export interface UpsertSignedDocumentInput {
  documentType: DocumentType;
  documentId: string;
  path: string;
  padesLevel: "B" | "B-T";
  tsaProvider?: string | null;
  signedAt: number;
  signatureEventId: string;
}

export interface VerifyChainResult {
  documentType: DocumentType;
  documentId: string;
  chainOk: boolean;
  chainLength: number;
  brokenChainIndices: number[];
}

export const signaturesApi = {
  async listEvents(documentType: DocumentType, documentId: string): Promise<SignatureEvent[]> {
    const res = await getApiClient().get<{ events: SignatureEvent[] }>("/api/signature-events", {
      documentType,
      documentId,
    });
    return res.events;
  },
  async appendEvent(input: AppendSignatureEventInput): Promise<SignatureEvent> {
    return getApiClient().post<SignatureEvent>("/api/signature-events", input);
  },
  async verifyChain(documentType: DocumentType, documentId: string): Promise<VerifyChainResult> {
    return getApiClient().get<VerifyChainResult>("/api/signature-events/verify", {
      documentType,
      documentId,
    });
  },
  async getSignedDocument(
    documentType: DocumentType,
    documentId: string
  ): Promise<SignedDocumentMeta> {
    return getApiClient().get<SignedDocumentMeta>(
      `/api/signed-documents/${documentType}/${documentId}`
    );
  },
  async upsertSignedDocument(input: UpsertSignedDocumentInput): Promise<SignedDocumentMeta> {
    return getApiClient().post<SignedDocumentMeta>("/api/signed-documents", input);
  },
};
