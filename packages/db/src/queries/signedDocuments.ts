/**
 * Queries métadonnées PDF signés.
 * Les bytes restent sur disque côté Rust (~/.fakt/signed/<hash>.pdf).
 * Cette table mémorise path + niveau PAdES + TSA + lien vers event signature.
 */

import { and, eq } from "drizzle-orm";
import type { DbInstance } from "../adapter.js";
import { signedDocuments } from "../schema/index.js";

// ─── Input / Output types ─────────────────────────────────────────────────────

export type PadesLevel = "B" | "B-T";

export interface SignedDocument {
  documentType: "quote" | "invoice";
  documentId: string;
  path: string;
  padesLevel: PadesLevel;
  tsaProvider: string | null;
  signedAt: number;
  signatureEventId: string;
}

export interface UpsertSignedDocumentInput {
  documentType: "quote" | "invoice";
  documentId: string;
  path: string;
  padesLevel: PadesLevel;
  tsaProvider?: string | null;
  signedAt: number;
  signatureEventId: string;
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function rowToSignedDocument(row: typeof signedDocuments.$inferSelect): SignedDocument {
  return {
    documentType: row.documentType,
    documentId: row.documentId,
    path: row.path,
    padesLevel: row.padesLevel as PadesLevel,
    tsaProvider: row.tsaProvider ?? null,
    signedAt: Number(row.signedAt),
    signatureEventId: row.signatureEventId,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Récupère les métadonnées d'un PDF signé, null si aucune. */
export function getSignedDocument(
  db: DbInstance,
  documentType: "quote" | "invoice",
  documentId: string
): SignedDocument | null {
  const row = db
    .select()
    .from(signedDocuments)
    .where(
      and(
        eq(signedDocuments.documentType, documentType),
        eq(signedDocuments.documentId, documentId)
      )
    )
    .get();
  if (!row) return null;
  return rowToSignedDocument(row);
}

/** Insert ou met à jour les métadonnées (UPSERT sur PK documentType+documentId). */
export function upsertSignedDocument(
  db: DbInstance,
  input: UpsertSignedDocumentInput
): SignedDocument {
  const existing = getSignedDocument(db, input.documentType, input.documentId);

  if (existing) {
    db.update(signedDocuments)
      .set({
        path: input.path,
        padesLevel: input.padesLevel,
        tsaProvider: input.tsaProvider ?? null,
        signedAt: new Date(input.signedAt),
        signatureEventId: input.signatureEventId,
      })
      .where(
        and(
          eq(signedDocuments.documentType, input.documentType),
          eq(signedDocuments.documentId, input.documentId)
        )
      )
      .run();
  } else {
    db.insert(signedDocuments)
      .values({
        documentType: input.documentType,
        documentId: input.documentId,
        path: input.path,
        padesLevel: input.padesLevel,
        tsaProvider: input.tsaProvider ?? null,
        signedAt: new Date(input.signedAt),
        signatureEventId: input.signatureEventId,
      })
      .run();
  }

  const reloaded = getSignedDocument(db, input.documentType, input.documentId);
  if (!reloaded) {
    throw new Error(
      `upsertSignedDocument: could not reload ${input.documentType}/${input.documentId}`
    );
  }
  return reloaded;
}
