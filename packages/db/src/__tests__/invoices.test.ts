import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  cannotDeleteIssued,
  createInvoice,
  createInvoiceFromQuote,
  getInvoice,
  listInvoices,
  markInvoicePaid,
  updateInvoice,
} from "../queries/invoices.js";
import { createQuote, updateQuoteStatus } from "../queries/quotes.js";
import { invoices } from "../schema/index.js";
import { CLIENT_ID_1, WORKSPACE_ID, createTestDb, seedClient, seedWorkspace } from "./helpers.js";
import type { TestDb } from "./helpers.js";

let db: TestDb;

const QUOTE_ID = "10000000-0000-0000-0000-000000000001";
const INV_ID = "30000000-0000-0000-0000-000000000001";
const INV_ID_2 = "30000000-0000-0000-0000-000000000002";
const LEGAL = "TVA non applicable, art. 293 B du CGI";

const BASE_ITEM = {
  id: "20000000-0000-0000-0000-000000000001",
  position: 0,
  description: "Prestation",
  quantity: 1000,
  unitPriceCents: 100000,
  unit: "forfait" as const,
  lineTotalCents: 100000,
  serviceId: null,
};

beforeEach(() => {
  ({ db } = createTestDb());
  seedWorkspace(db);
  seedClient(db);
});

function makeSignedQuote() {
  createQuote(db, {
    id: QUOTE_ID,
    workspaceId: WORKSPACE_ID,
    clientId: CLIENT_ID_1,
    title: "Devis test",
    totalHtCents: 100000,
    items: [BASE_ITEM],
  });
  updateQuoteStatus(db, QUOTE_ID, "sent");
  updateQuoteStatus(db, QUOTE_ID, "signed");
}

describe("cannotDeleteIssued", () => {
  it("retourne true pour les statuts émis", () => {
    expect(cannotDeleteIssued("sent")).toBe(true);
    expect(cannotDeleteIssued("paid")).toBe(true);
    expect(cannotDeleteIssued("overdue")).toBe(true);
    expect(cannotDeleteIssued("cancelled")).toBe(true);
  });

  it("retourne false pour draft uniquement", () => {
    expect(cannotDeleteIssued("draft")).toBe(false);
  });
});

describe("createInvoice", () => {
  it("crée une facture avec ses lignes", () => {
    const inv = createInvoice(db, {
      id: INV_ID,
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID_1,
      kind: "independent",
      title: "Maintenance mensuelle",
      totalHtCents: 50000,
      legalMentions: LEGAL,
      items: [{ ...BASE_ITEM, lineTotalCents: 50000, unitPriceCents: 50000 }],
    });
    expect(inv.id).toBe(INV_ID);
    expect(inv.status).toBe("draft");
    expect(inv.items).toHaveLength(1);
    expect(inv.kind).toBe("independent");
  });
});

describe("getInvoice", () => {
  it("retourne null pour un ID inexistant", () => {
    expect(getInvoice(db, "no")).toBeNull();
  });

  it("retourne la facture avec items", () => {
    createInvoice(db, {
      id: INV_ID,
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID_1,
      kind: "total",
      title: "F",
      totalHtCents: 0,
      legalMentions: LEGAL,
      items: [],
    });
    expect(getInvoice(db, INV_ID)?.title).toBe("F");
  });
});

describe("listInvoices", () => {
  beforeEach(() => {
    createInvoice(db, {
      id: INV_ID,
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID_1,
      kind: "total",
      title: "F1",
      totalHtCents: 0,
      legalMentions: LEGAL,
      items: [],
    });
    createInvoice(db, {
      id: INV_ID_2,
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID_1,
      kind: "total",
      title: "F2",
      totalHtCents: 0,
      legalMentions: LEGAL,
      items: [],
    });
  });

  it("liste les factures du workspace", () => {
    expect(listInvoices(db, { workspaceId: WORKSPACE_ID })).toHaveLength(2);
  });

  it("filtre par statut unique", () => {
    db.update(invoices).set({ status: "sent" }).where(eq(invoices.id, INV_ID)).run();
    const drafts = listInvoices(db, { workspaceId: WORKSPACE_ID, status: "draft" });
    expect(drafts.some((i) => i.id === INV_ID_2)).toBe(true);
    expect(drafts.every((i) => i.status === "draft")).toBe(true);
  });

  it("filtre par plusieurs statuts (array)", () => {
    db.update(invoices).set({ status: "sent" }).where(eq(invoices.id, INV_ID)).run();
    const results = listInvoices(db, { workspaceId: WORKSPACE_ID, status: ["draft", "sent"] });
    expect(results).toHaveLength(2);
  });
});

describe("updateInvoice", () => {
  beforeEach(() =>
    createInvoice(db, {
      id: INV_ID,
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID_1,
      kind: "total",
      title: "Old",
      totalHtCents: 100000,
      legalMentions: LEGAL,
      items: [],
    })
  );

  it("met à jour le titre", () => {
    const updated = updateInvoice(db, INV_ID, { title: "Nouveau" });
    expect(updated.title).toBe("Nouveau");
  });

  it("lève une erreur pour un ID inexistant", () => {
    expect(() => updateInvoice(db, "bad-id", { title: "X" })).toThrow();
  });
});

describe("markInvoicePaid", () => {
  it("transite sent → paid", () => {
    createInvoice(db, {
      id: INV_ID,
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID_1,
      kind: "total",
      title: "F",
      totalHtCents: 100000,
      legalMentions: LEGAL,
      items: [],
    });
    // Passe en sent via SQL direct (pas de commande métier pour cela en Track B)
    db.update(invoices).set({ status: "sent" }).where(eq(invoices.id, INV_ID)).run();
    const paid = markInvoicePaid(db, INV_ID, Date.now(), "wire");
    expect(paid.status).toBe("paid");
    expect(paid.paymentMethod).toBe("wire");
    expect(paid.paidAt).toBeTypeOf("number");
  });

  it("échoue pour une facture draft", () => {
    createInvoice(db, {
      id: INV_ID,
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID_1,
      kind: "total",
      title: "F",
      totalHtCents: 100000,
      legalMentions: LEGAL,
      items: [],
    });
    expect(() => markInvoicePaid(db, INV_ID, Date.now(), "wire")).toThrow(/invalid transition/);
  });

  it("lève une erreur pour un ID inexistant", () => {
    expect(() => markInvoicePaid(db, "bad-id", Date.now(), "wire")).toThrow();
  });
});

describe("createInvoiceFromQuote", () => {
  beforeEach(() => makeSignedQuote());

  it("mode full : crée une facture totale", () => {
    const inv = createInvoiceFromQuote(db, INV_ID, QUOTE_ID, "full", LEGAL);
    expect(inv.totalHtCents).toBe(100000);
    expect(inv.kind).toBe("total");
    expect(inv.quoteId).toBe(QUOTE_ID);
  });

  it("mode deposit30 : calcule 30% du total", () => {
    const inv = createInvoiceFromQuote(db, INV_ID, QUOTE_ID, "deposit30", LEGAL);
    expect(inv.totalHtCents).toBe(30000);
    expect(inv.kind).toBe("deposit");
    expect(inv.depositPercent).toBe(30);
  });

  it("mode balance : calcule le solde après acompte émis (status sent|paid|overdue)", () => {
    // P0-A : seul un deposit en status sent|paid|overdue compte. Un deposit draft
    // n'a pas d'existence légale (pas de numéro attribué) — il ne doit pas réduire
    // le solde (sinon facturation incomplète = fuite d'argent).
    createInvoiceFromQuote(db, INV_ID, QUOTE_ID, "deposit30", LEGAL);
    // Simule l'émission de l'acompte (draft→sent) via SQL direct.
    db.update(invoices).set({ status: "sent" }).where(eq(invoices.id, INV_ID)).run();

    const balance = createInvoiceFromQuote(db, INV_ID_2, QUOTE_ID, "balance", LEGAL);
    expect(balance.totalHtCents).toBe(70000);
    expect(balance.kind).toBe("balance");
  });

  it("mode balance : ignore un deposit30 resté en draft (pas émis légalement)", () => {
    // Deposit créé mais jamais émis → reste draft → ne doit PAS réduire le solde.
    createInvoiceFromQuote(db, INV_ID, QUOTE_ID, "deposit30", LEGAL);
    const balance = createInvoiceFromQuote(db, INV_ID_2, QUOTE_ID, "balance", LEGAL);
    expect(balance.totalHtCents).toBe(100000);
    expect(balance.kind).toBe("balance");
  });

  it("mode balance : ignore un deposit30 en status cancelled", () => {
    createInvoiceFromQuote(db, INV_ID, QUOTE_ID, "deposit30", LEGAL);
    db.update(invoices).set({ status: "cancelled" }).where(eq(invoices.id, INV_ID)).run();
    const balance = createInvoiceFromQuote(db, INV_ID_2, QUOTE_ID, "balance", LEGAL);
    expect(balance.totalHtCents).toBe(100000);
  });

  it("refuse si le devis n'est pas signé", () => {
    createQuote(db, {
      id: "10000000-0000-0000-0000-000000000099",
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID_1,
      title: "Draft",
      totalHtCents: 0,
      items: [],
    });
    expect(() =>
      createInvoiceFromQuote(db, INV_ID, "10000000-0000-0000-0000-000000000099", "full", LEGAL)
    ).toThrow(/signed/);
  });

  it("refuse si le devis est inexistant", () => {
    expect(() => createInvoiceFromQuote(db, INV_ID, "no-quote", "full", LEGAL)).toThrow();
  });
});
