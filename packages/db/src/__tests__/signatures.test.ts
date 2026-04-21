import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedWorkspace, WORKSPACE_ID } from "./helpers.js";
import { appendSignatureEvent, getSignatureChain } from "../queries/signatures.js";
import type { TestDb } from "./helpers.js";
import type Database from "better-sqlite3";

let db: TestDb;
let sqlite: Database.Database;

const DOC_ID = "10000000-0000-0000-0000-000000000001";
const EVENT_1_ID = "50000000-0000-0000-0000-000000000001";
const EVENT_2_ID = "50000000-0000-0000-0000-000000000002";

const BASE_EVENT = {
  id: EVENT_1_ID,
  documentType: "quote" as const,
  documentId: DOC_ID,
  signerName: "Tom Andrieu",
  signerEmail: "tom@test.fr",
  timestamp: Date.now(),
  docHashBefore: "abc123def456",
  docHashAfter: "xyz789ghi012",
  signaturePngBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  previousEventHash: null,
};

beforeEach(() => {
  ({ db, sqlite } = createTestDb());
  seedWorkspace(db);
});

describe("appendSignatureEvent", () => {
  it("insère un événement et le retourne typé", () => {
    const event = appendSignatureEvent(db, BASE_EVENT);
    expect(event.id).toBe(EVENT_1_ID);
    expect(event.signerName).toBe("Tom Andrieu");
    expect(event.docHashBefore).toBe("abc123def456");
    expect(event.previousEventHash).toBeNull();
  });

  it("chaîne le hash du précédent événement", () => {
    appendSignatureEvent(db, BASE_EVENT);
    const event2 = appendSignatureEvent(db, {
      ...BASE_EVENT,
      id: EVENT_2_ID,
      previousEventHash: "hash-of-event-1",
    });
    expect(event2.previousEventHash).toBe("hash-of-event-1");
  });
});

describe("getSignatureChain", () => {
  it("retourne la chaîne dans l'ordre chronologique", () => {
    const t1 = Date.now();
    const t2 = t1 + 1000;
    appendSignatureEvent(db, { ...BASE_EVENT, id: EVENT_1_ID, timestamp: t1 });
    appendSignatureEvent(db, { ...BASE_EVENT, id: EVENT_2_ID, timestamp: t2, previousEventHash: "prev-hash" });

    const chain = getSignatureChain(db, "quote", DOC_ID);
    expect(chain).toHaveLength(2);
    expect(chain[0]?.id).toBe(EVENT_1_ID);
    expect(chain[1]?.id).toBe(EVENT_2_ID);
  });

  it("retourne tableau vide si aucun événement", () => {
    const chain = getSignatureChain(db, "quote", "non-existent-doc");
    expect(chain).toHaveLength(0);
  });
});

describe("append-only enforcement (trigger SQL)", () => {
  it("bloque un UPDATE sur signature_events", () => {
    appendSignatureEvent(db, BASE_EVENT);
    // Test via l'instance better-sqlite3 directement
    const stmt = sqlite.prepare(`UPDATE signature_events SET signer_name = 'Hacker' WHERE id = ?`);
    expect(() => stmt.run(EVENT_1_ID)).toThrow(/append-only/);
  });

  it("bloque un DELETE sur signature_events", () => {
    appendSignatureEvent(db, BASE_EVENT);
    const stmt = sqlite.prepare(`DELETE FROM signature_events WHERE id = ?`);
    expect(() => stmt.run(EVENT_1_ID)).toThrow(/append-only/);
  });
});
