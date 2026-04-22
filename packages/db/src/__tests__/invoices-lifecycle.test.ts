import { beforeEach, describe, expect, it } from "vitest";
import {
  archiveInvoice,
  createInvoice,
  deleteInvoice,
  issueInvoice,
  searchInvoices,
  updateInvoiceStatus,
} from "../queries/invoices.js";
import { CLIENT_ID_1, WORKSPACE_ID, createTestDb, seedClient, seedWorkspace } from "./helpers.js";
import type { TestDb } from "./helpers.js";

let db: TestDb;

const INV_ID = "30000000-0000-4000-8000-000000000100";
const INV_ID_2 = "30000000-0000-4000-8000-000000000200";
const ITEM_ID = "20000000-0000-4000-8000-000000000100";
const ITEM_ID_2 = "20000000-0000-4000-8000-000000000200";
const LEGAL = "TVA non applicable, art. 293 B du CGI";

beforeEach(() => {
  ({ db } = createTestDb());
  seedWorkspace(db);
  seedClient(db);
});

function mk(id = INV_ID, itemId = ITEM_ID, title = "Prestation") {
  return createInvoice(db, {
    id,
    workspaceId: WORKSPACE_ID,
    clientId: CLIENT_ID_1,
    kind: "independent",
    title,
    totalHtCents: 100_000,
    legalMentions: LEGAL,
    items: [
      {
        id: itemId,
        position: 0,
        description: "Item",
        quantity: 1,
        unitPriceCents: 100_000,
        unit: "forfait",
        lineTotalCents: 100_000,
      },
    ],
  });
}

describe("deleteInvoice", () => {
  it("supprime une draft", () => {
    mk();
    deleteInvoice(db, INV_ID);
    // pas d'erreur = supprimé. 2e delete throw "not found"
    expect(() => deleteInvoice(db, INV_ID)).toThrow(/not found/i);
  });

  it("throw si invoice introuvable", () => {
    expect(() => deleteInvoice(db, "99999999-9999-4999-8999-999999999999")).toThrow(/not found/i);
  });

  it("throw si invoice pas en draft (archivage légal 10 ans)", () => {
    mk();
    // issue → sent
    issueInvoice(db, INV_ID, { formatted: "2026-F-0001", year: 2026, sequence: 1 });
    expect(() => deleteInvoice(db, INV_ID)).toThrow(/archivage légal|hard delete/i);
  });
});

describe("issueInvoice", () => {
  it("attribue number+year+sequence et passe à sent", () => {
    mk();
    const issued = issueInvoice(db, INV_ID, {
      formatted: "2026-F-0042",
      year: 2026,
      sequence: 42,
    });
    expect(issued.number).toBe("2026-F-0042");
    expect(issued.year).toBe(2026);
    expect(issued.sequence).toBe(42);
    expect(issued.status).toBe("sent");
    expect(issued.issuedAt).toBeTruthy();
  });

  it("throw si invoice non draft", () => {
    mk();
    issueInvoice(db, INV_ID, { formatted: "2026-F-0001", year: 2026, sequence: 1 });
    expect(() =>
      issueInvoice(db, INV_ID, { formatted: "2026-F-0002", year: 2026, sequence: 2 })
    ).toThrow(/only draft/i);
  });

  it("throw si invoice introuvable", () => {
    expect(() =>
      issueInvoice(db, "99999999-9999-4999-8999-999999999999", {
        formatted: "x",
        year: 2026,
        sequence: 1,
      })
    ).toThrow(/not found/i);
  });
});

describe("updateInvoiceStatus", () => {
  it("sent → paid transition valide", () => {
    mk();
    issueInvoice(db, INV_ID, { formatted: "x", year: 2026, sequence: 1 });
    const updated = updateInvoiceStatus(db, INV_ID, "paid");
    expect(updated.status).toBe("paid");
  });

  it("sent → overdue transition valide", () => {
    mk();
    issueInvoice(db, INV_ID, { formatted: "x", year: 2026, sequence: 1 });
    const updated = updateInvoiceStatus(db, INV_ID, "overdue");
    expect(updated.status).toBe("overdue");
  });

  it("throw sur transition invalide (draft → paid)", () => {
    mk();
    expect(() => updateInvoiceStatus(db, INV_ID, "paid")).toThrow(/invalid transition/i);
  });

  it("throw si invoice introuvable", () => {
    expect(() => updateInvoiceStatus(db, "99999999-9999-4999-8999-999999999999", "paid")).toThrow(
      /not found/i
    );
  });
});

describe("archiveInvoice", () => {
  it("set archivedAt sur la facture", () => {
    mk();
    const archived = archiveInvoice(db, INV_ID);
    expect(archived.archivedAt).not.toBeNull();
  });

  it("throw si introuvable", () => {
    expect(() => archiveInvoice(db, "99999999-9999-4999-8999-999999999999")).toThrow(/not found/i);
  });
});

describe("searchInvoices", () => {
  it("match par titre", () => {
    mk(INV_ID, ITEM_ID, "Prestation Alpha");
    mk(INV_ID_2, ITEM_ID_2, "Autre chose");
    const res = searchInvoices(db, WORKSPACE_ID, "Alpha");
    expect(res).toHaveLength(1);
    expect(res[0]?.id).toBe(INV_ID);
  });

  it("match par numéro après issue", () => {
    mk();
    issueInvoice(db, INV_ID, { formatted: "2026-F-0001", year: 2026, sequence: 1 });
    const res = searchInvoices(db, WORKSPACE_ID, "2026-F");
    expect(res.length).toBeGreaterThanOrEqual(1);
  });

  it("exclut les archivées", () => {
    mk(INV_ID, ITEM_ID, "Prestation Alpha");
    archiveInvoice(db, INV_ID);
    const res = searchInvoices(db, WORKSPACE_ID, "Alpha");
    expect(res).toHaveLength(0);
  });

  it("retourne vide si aucun match", () => {
    mk();
    const res = searchInvoices(db, WORKSPACE_ID, "ZZZNomatch");
    expect(res).toHaveLength(0);
  });
});
