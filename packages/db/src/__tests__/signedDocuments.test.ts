import { beforeEach, describe, expect, it } from "vitest";
import { getSignedDocument, upsertSignedDocument } from "../queries/signedDocuments.js";
import { createTestDb, seedWorkspace } from "./helpers.js";
import type { TestDb } from "./helpers.js";

let db: TestDb;

const DOC_ID = "10000000-0000-4000-8000-000000000001";
const EV_ID = "20000000-0000-4000-8000-000000000001";

beforeEach(() => {
  ({ db } = createTestDb());
  seedWorkspace(db);
});

describe("upsertSignedDocument", () => {
  it("insère si non existant", () => {
    const doc = upsertSignedDocument(db, {
      documentType: "quote",
      documentId: DOC_ID,
      path: "/tmp/signed.pdf",
      padesLevel: "B",
      signedAt: 1_700_000_000_000,
      signatureEventId: EV_ID,
    });
    expect(doc.path).toBe("/tmp/signed.pdf");
    expect(doc.padesLevel).toBe("B");
    expect(doc.tsaProvider).toBeNull();
  });

  it("update si existe déjà (upsert)", () => {
    upsertSignedDocument(db, {
      documentType: "quote",
      documentId: DOC_ID,
      path: "/old.pdf",
      padesLevel: "B",
      signedAt: 1_000,
      signatureEventId: EV_ID,
    });
    const updated = upsertSignedDocument(db, {
      documentType: "quote",
      documentId: DOC_ID,
      path: "/new.pdf",
      padesLevel: "B-T",
      tsaProvider: "freetsa.org",
      signedAt: 2_000,
      signatureEventId: EV_ID,
    });
    expect(updated.path).toBe("/new.pdf");
    expect(updated.padesLevel).toBe("B-T");
    expect(updated.tsaProvider).toBe("freetsa.org");
  });
});

describe("getSignedDocument", () => {
  it("retourne null si aucun", () => {
    expect(getSignedDocument(db, "quote", DOC_ID)).toBeNull();
  });

  it("retourne la métadonnée si existante", () => {
    upsertSignedDocument(db, {
      documentType: "invoice",
      documentId: DOC_ID,
      path: "/x.pdf",
      padesLevel: "B-T",
      tsaProvider: "freetsa.org",
      signedAt: 3_000,
      signatureEventId: EV_ID,
    });
    const doc = getSignedDocument(db, "invoice", DOC_ID);
    expect(doc).not.toBeNull();
    expect(doc?.padesLevel).toBe("B-T");
    expect(doc?.signatureEventId).toBe(EV_ID);
  });

  it("scope par documentType (quote vs invoice)", () => {
    upsertSignedDocument(db, {
      documentType: "quote",
      documentId: DOC_ID,
      path: "/q.pdf",
      padesLevel: "B",
      signedAt: 1,
      signatureEventId: EV_ID,
    });
    expect(getSignedDocument(db, "quote", DOC_ID)).not.toBeNull();
    expect(getSignedDocument(db, "invoice", DOC_ID)).toBeNull();
  });
});
