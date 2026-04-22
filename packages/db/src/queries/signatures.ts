/**
 * Queries audit trail signatures — append-only.
 * Règles critiques :
 * - Aucune méthode update ou delete n'est exposée (FR-018, CLAUDE.md sécurité)
 * - Le trigger SQL signature_events_no_update / signature_events_no_delete
 *   renforce la contrainte côté DB (migration 0001_triggers.sql)
 * - previousEventHash chaîne les événements (intégrité SHA-256)
 */

import type { SignatureEvent } from "@fakt/shared";
import { and, asc, eq } from "drizzle-orm";
import type { DbInstance } from "../adapter.js";
import { signatureEvents } from "../schema/index.js";

// ─── Input types ──────────────────────────────────────────────────────────────

export interface AppendSignatureEventInput {
  id: string;
  documentType: "quote" | "invoice";
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

// ─── Row mapper ───────────────────────────────────────────────────────────────

function rowToEvent(row: typeof signatureEvents.$inferSelect): SignatureEvent {
  return {
    id: row.id,
    documentType: row.documentType,
    documentId: row.documentId,
    signerName: row.signerName,
    signerEmail: row.signerEmail,
    ipAddress: row.ipAddress ?? null,
    userAgent: row.userAgent ?? null,
    timestamp: Number(row.timestamp),
    docHashBefore: row.docHashBefore,
    docHashAfter: row.docHashAfter,
    signaturePngBase64: row.signaturePngBase64,
    previousEventHash: row.previousEventHash ?? null,
    tsaResponse: row.tsaResponse ?? null,
    tsaProvider: row.tsaProvider ?? null,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Insère un nouvel événement de signature (append-only).
 * Le trigger SQL bloque toute tentative d'UPDATE ou DELETE ultérieure.
 */
export function appendSignatureEvent(
  db: DbInstance,
  input: AppendSignatureEventInput
): SignatureEvent {
  const row = db
    .insert(signatureEvents)
    .values({
      id: input.id,
      documentType: input.documentType,
      documentId: input.documentId,
      signerName: input.signerName,
      signerEmail: input.signerEmail,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      timestamp: new Date(input.timestamp),
      docHashBefore: input.docHashBefore,
      docHashAfter: input.docHashAfter,
      signaturePngBase64: input.signaturePngBase64,
      previousEventHash: input.previousEventHash ?? null,
      tsaResponse: input.tsaResponse ?? null,
      tsaProvider: input.tsaProvider ?? null,
    })
    .returning()
    .get();

  if (!row) throw new Error(`appendSignatureEvent: insert returned no row for id=${input.id}`);
  return rowToEvent(row);
}

/**
 * Retourne la chaîne complète des événements de signature pour un document,
 * triée par timestamp croissant (du plus ancien au plus récent).
 */
export function getSignatureChain(
  db: DbInstance,
  documentType: "quote" | "invoice",
  documentId: string
): SignatureEvent[] {
  const rows = db
    .select()
    .from(signatureEvents)
    .where(
      and(
        eq(signatureEvents.documentType, documentType),
        eq(signatureEvents.documentId, documentId)
      )
    )
    .orderBy(asc(signatureEvents.timestamp))
    .all();

  return rows.map(rowToEvent);
}
