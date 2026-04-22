import { Hono } from "hono";
import { createHash } from "node:crypto";
import type { AppEnv } from "../types.js";
import { notFound, badRequest } from "../errors.js";
import { parseBody, parseQuery, parseParam } from "../middleware/zod.js";
import { uuidSchema } from "../schemas/common.js";
import {
  appendSignatureEventSchema,
  signatureEventsQuerySchema,
  upsertSignedDocumentSchema,
  documentTypeSchema,
} from "../schemas/signatures.js";
import {
  appendSignatureEvent,
  getSignatureChain,
  getSignedDocument,
  upsertSignedDocument,
} from "@fakt/db/queries";
import type { SignatureEvent } from "@fakt/shared";

export const signaturesRoutes = new Hono<AppEnv>();

// ─── Signature events (audit append-only) ────────────────────────────────────

/** GET /api/signature-events?documentType=quote&documentId=<uuid> — chain ordonnée. */
signaturesRoutes.get("/signature-events", (c) => {
  const query = parseQuery(c, signatureEventsQuerySchema);
  const events = getSignatureChain(c.var.db, query.documentType, query.documentId);
  return c.json({ events });
});

/**
 * POST /api/signature-events — append event (immutable).
 * Le trigger SQL `signature_events_no_update` + `_no_delete` renforce append-only.
 */
signaturesRoutes.post("/signature-events", async (c) => {
  const body = await parseBody(c, appendSignatureEventSchema);
  const created = appendSignatureEvent(c.var.db, {
    id: body.id,
    documentType: body.documentType,
    documentId: body.documentId,
    signerName: body.signerName,
    signerEmail: body.signerEmail,
    ipAddress: body.ipAddress ?? null,
    userAgent: body.userAgent ?? null,
    timestamp: body.timestamp,
    docHashBefore: body.docHashBefore,
    docHashAfter: body.docHashAfter,
    signaturePngBase64: body.signaturePngBase64,
    previousEventHash: body.previousEventHash ?? null,
    tsaResponse: body.tsaResponse ?? null,
    tsaProvider: body.tsaProvider ?? null,
  });
  return c.json(created, 201);
});

/**
 * Sérialisation canonique d'un event pour calcul SHA-256.
 * Doit être stable : ordre alphabétique des clés, null explicites, pas de timestamps locaux.
 */
function serializeEvent(e: SignatureEvent): string {
  const canonical = {
    docHashAfter: e.docHashAfter,
    docHashBefore: e.docHashBefore,
    documentId: e.documentId,
    documentType: e.documentType,
    id: e.id,
    ipAddress: e.ipAddress,
    signaturePngBase64: e.signaturePngBase64,
    signerEmail: e.signerEmail,
    signerName: e.signerName,
    timestamp: e.timestamp,
    tsaProvider: e.tsaProvider,
    tsaResponse: e.tsaResponse,
    userAgent: e.userAgent,
  };
  return JSON.stringify(canonical);
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * GET /api/signature-events/verify?documentType=...&documentId=... — verify chain SHA-256.
 * Retourne { chainOk, chainLength, brokenChainIndices }.
 * Pour chaque event i > 0 : sha256(serialize(events[i-1])) doit == events[i].previousEventHash.
 */
signaturesRoutes.get("/signature-events/verify", (c) => {
  const query = parseQuery(c, signatureEventsQuerySchema);
  const events = getSignatureChain(c.var.db, query.documentType, query.documentId);
  const brokenChainIndices: number[] = [];

  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1];
    const curr = events[i];
    if (!prev || !curr) continue;
    const expected = sha256Hex(serializeEvent(prev));
    if (curr.previousEventHash !== expected) {
      brokenChainIndices.push(i);
    }
  }

  return c.json({
    documentType: query.documentType,
    documentId: query.documentId,
    chainOk: brokenChainIndices.length === 0,
    chainLength: events.length,
    brokenChainIndices,
  });
});

// ─── Signed documents (métadonnées PDF) ──────────────────────────────────────

/** GET /api/signed-documents/:documentType/:documentId — métadonnées PDF signé. */
signaturesRoutes.get("/signed-documents/:documentType/:documentId", (c) => {
  const typeRaw = c.req.param("documentType");
  const typeResult = documentTypeSchema.safeParse(typeRaw);
  if (!typeResult.success) {
    throw badRequest(`documentType invalide : ${typeRaw} (quote|invoice attendu)`);
  }
  const documentId = parseParam(c, "documentId", uuidSchema);
  const meta = getSignedDocument(c.var.db, typeResult.data, documentId);
  if (!meta) {
    throw notFound(`aucune signature enregistrée pour ${typeResult.data}/${documentId}`);
  }
  return c.json(meta);
});

/** POST /api/signed-documents — upsert métadonnées (appelé par Rust après store_signed_pdf). */
signaturesRoutes.post("/signed-documents", async (c) => {
  const body = await parseBody(c, upsertSignedDocumentSchema);
  const created = upsertSignedDocument(c.var.db, {
    documentType: body.documentType,
    documentId: body.documentId,
    path: body.path,
    padesLevel: body.padesLevel,
    tsaProvider: body.tsaProvider ?? null,
    signedAt: body.signedAt,
    signatureEventId: body.signatureEventId,
  });
  return c.json(created, 201);
});
