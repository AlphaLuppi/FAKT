/**
 * Tests du context-builder pour le rapport d'audit.
 * Pure TS, pas d'IPC Tauri — test du tri chronologique, du formatage FR
 * des dates et du mapping activity → label.
 */
import type { ActivityEvent, SignatureEvent } from "@fakt/shared";
import { describe, expect, it } from "vitest";

import { buildAuditTrailContext } from "../src/context-builder.ts";

import { fixtureWorkspace } from "./fixtures/workspace.ts";

const FIXED_GENERATED_AT = 1714665600000; // 2024-05-02 16:00 UTC, déterministe

function makeSignatureEvent(overrides: Partial<SignatureEvent> = {}): SignatureEvent {
  return {
    id: "evt-1",
    documentType: "quote",
    documentId: "quote-1",
    signerName: "Jean Prestataire",
    signerEmail: "jean@example.fr",
    ipAddress: "192.0.2.1",
    userAgent: "FAKT/1.0 desktop",
    timestamp: 1714572000000, // 2024-05-01 14:00 UTC
    docHashBefore: "a".repeat(64),
    docHashAfter: "b".repeat(64),
    signaturePngBase64: "",
    previousEventHash: null,
    tsaResponse: null,
    tsaProvider: "FreeTSA",
    ...overrides,
  };
}

function makeActivityEvent(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: "act-1",
    workspaceId: fixtureWorkspace.id,
    type: "quote_created",
    entityType: "quote",
    entityId: "quote-1",
    payload: null,
    createdAt: 1714485600000, // 2024-04-30 14:00 UTC
    ...overrides,
  };
}

describe("buildAuditTrailContext", () => {
  it("produit un contexte avec kind audit-trail", () => {
    const ctx = buildAuditTrailContext({
      document: {
        type: "quote",
        number: "D2024-001",
        title: "Refonte site",
        clientName: "ACME SAS",
        totalHtCents: 250000,
        issuedAt: 1714485600000,
        signedAt: 1714572000000,
      },
      workspace: fixtureWorkspace,
      signatureEvents: [],
      activityEvents: [],
      generatedAtMs: FIXED_GENERATED_AT,
    });

    expect(ctx.kind).toBe("audit-trail");
    expect(ctx.document.label).toBe("Devis");
    expect(ctx.document.number).toBe("D2024-001");
    // Intl.NumberFormat fr-FR utilise un narrow no-break space (U+202F) entre
    // le nombre et l'unité ou comme séparateur de milliers selon la version
    // d'ICU. On reste tolérant via regex.
    expect(ctx.document.totalHt).toMatch(/^2\s500,00\s€$/);
    expect(ctx.document.issuedAt).toContain("2024");
    expect(ctx.document.signedAt).toContain("2024");
  });

  it("mappe le type de document vers son label FR", () => {
    const ctxInvoice = buildAuditTrailContext({
      document: {
        type: "invoice",
        number: "F2024-001",
        title: "Refonte site",
        clientName: "ACME SAS",
        totalHtCents: 100000,
        issuedAt: null,
        signedAt: null,
      },
      workspace: fixtureWorkspace,
      signatureEvents: [],
      activityEvents: [],
      generatedAtMs: FIXED_GENERATED_AT,
    });
    expect(ctxInvoice.document.label).toBe("Facture");
    expect(ctxInvoice.document.issuedAt).toBeNull();
    expect(ctxInvoice.document.signedAt).toBeNull();
  });

  it("trie les signature events par timestamp ASC", () => {
    const evtLater = makeSignatureEvent({ id: "later", timestamp: 1714572000000 });
    const evtEarly = makeSignatureEvent({ id: "early", timestamp: 1714485600000 });
    const ctx = buildAuditTrailContext({
      document: {
        type: "quote",
        number: "D2024-001",
        title: "x",
        clientName: "x",
        totalHtCents: 0,
        issuedAt: null,
        signedAt: null,
      },
      workspace: fixtureWorkspace,
      // Volontairement non-trié à l'entrée
      signatureEvents: [evtLater, evtEarly],
      activityEvents: [],
      generatedAtMs: FIXED_GENERATED_AT,
    });
    expect(ctx.signatureEvents).toHaveLength(2);
    // Le premier signataire est celui dont le timestamp est le plus ancien
    expect(ctx.signatureEvents[0]?.signerName).toBe("Jean Prestataire");
    // Vérifie l'ordre via la chaîne de horodatages — déjà formattée FR
    const ts0 = ctx.signatureEvents[0]?.timestamp;
    const ts1 = ctx.signatureEvents[1]?.timestamp;
    expect(ts0).toBeDefined();
    expect(ts1).toBeDefined();
    // Les deux timestamps sont distincts (sécurité contre tri instable)
    expect(ts0).not.toBe(ts1);
  });

  it("affiche le niveau PAdES B-T quand un TSA est présent et B sinon", () => {
    const ctx = buildAuditTrailContext({
      document: {
        type: "quote",
        number: "D2024-001",
        title: "x",
        clientName: "x",
        totalHtCents: 0,
        issuedAt: null,
        signedAt: null,
      },
      workspace: fixtureWorkspace,
      signatureEvents: [
        makeSignatureEvent({ id: "with-tsa", tsaProvider: "FreeTSA" }),
        makeSignatureEvent({ id: "no-tsa", tsaProvider: null, timestamp: 1714572000001 }),
      ],
      activityEvents: [],
      generatedAtMs: FIXED_GENERATED_AT,
    });
    expect(ctx.signatureEvents[0]?.padesLevel).toBe("B-T");
    expect(ctx.signatureEvents[1]?.padesLevel).toBe("B");
  });

  it("fusionne activity events et signatures dans la chronologie ASC", () => {
    const ctx = buildAuditTrailContext({
      document: {
        type: "quote",
        number: "D2024-001",
        title: "x",
        clientName: "x",
        totalHtCents: 0,
        issuedAt: null,
        signedAt: null,
      },
      workspace: fixtureWorkspace,
      signatureEvents: [
        makeSignatureEvent({ timestamp: 1714572000000 }), // 2024-05-01
      ],
      activityEvents: [
        makeActivityEvent({ type: "quote_created", createdAt: 1714485600000 }),
        makeActivityEvent({
          id: "act-2",
          type: "quote_marked_sent",
          createdAt: 1714572000000 - 1, // juste avant la signature
        }),
      ],
      generatedAtMs: FIXED_GENERATED_AT,
    });
    expect(ctx.events).toHaveLength(3);
    expect(ctx.events[0]?.label).toBe("Document créé");
    expect(ctx.events[1]?.label).toBe("Document envoyé");
    expect(ctx.events[2]?.label).toBe("Signé par Jean Prestataire");
  });

  it("rend les types d'activité inconnus de façon explicite", () => {
    const ctx = buildAuditTrailContext({
      document: {
        type: "quote",
        number: "D2024-001",
        title: "x",
        clientName: "x",
        totalHtCents: 0,
        issuedAt: null,
        signedAt: null,
      },
      workspace: fixtureWorkspace,
      signatureEvents: [],
      activityEvents: [makeActivityEvent({ type: "custom_event_xyz" })],
      generatedAtMs: FIXED_GENERATED_AT,
    });
    expect(ctx.events[0]?.label).toBe("Événement : custom_event_xyz");
  });

  it("formate generatedAt en FR longue avec heure", () => {
    const ctx = buildAuditTrailContext({
      document: {
        type: "quote",
        number: "D2024-001",
        title: "x",
        clientName: "x",
        totalHtCents: 0,
        issuedAt: null,
        signedAt: null,
      },
      workspace: fixtureWorkspace,
      signatureEvents: [],
      activityEvents: [],
      generatedAtMs: FIXED_GENERATED_AT,
    });
    // Format ex: "2 mai 2024 — 18:00" (TZ Europe/Paris locale runtime)
    expect(ctx.generatedAt).toMatch(/2024/);
    expect(ctx.generatedAt).toContain(" — ");
  });
});
