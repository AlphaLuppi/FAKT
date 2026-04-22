import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import {
  createTestDb,
  seedWorkspace,
  seedClient,
  WORKSPACE_ID,
  CLIENT_ID_1,
} from "./helpers.js";
import { invoices } from "../schema/index.js";
import {
  createInvoice,
  getInvoice,
  markInvoicePaid,
} from "../queries/invoices.js";
import type { TestDb } from "./helpers.js";

let db: TestDb;

const INV_ID = "30000000-0000-0000-0000-000000000101";
const LEGAL = "TVA non applicable, art. 293 B du CGI";

beforeEach(() => {
  ({ db } = createTestDb());
  seedWorkspace(db);
  seedClient(db);
  createInvoice(db, {
    id: INV_ID,
    workspaceId: WORKSPACE_ID,
    clientId: CLIENT_ID_1,
    kind: "total",
    title: "F à marquer payée",
    totalHtCents: 100000,
    legalMentions: LEGAL,
    items: [],
  });
  db.update(invoices).set({ status: "sent" }).where(eq(invoices.id, INV_ID)).run();
});

describe("markInvoicePaid + payment_notes", () => {
  it("persiste les notes de paiement et les relit depuis getInvoice", () => {
    const notes = "Virement reçu le 2026-04-22";
    const paid = markInvoicePaid(db, INV_ID, Date.now(), "wire", notes);

    expect(paid.status).toBe("paid");
    expect(paid.paymentNotes).toBe(notes);

    const reloaded = getInvoice(db, INV_ID);
    expect(reloaded).not.toBeNull();
    expect(reloaded?.paymentNotes).toBe(notes);
  });

  it("accepte undefined pour notes et renvoie null", () => {
    const paid = markInvoicePaid(db, INV_ID, Date.now(), "check");
    expect(paid.paymentNotes).toBeNull();

    const reloaded = getInvoice(db, INV_ID);
    expect(reloaded?.paymentNotes).toBeNull();
  });

  it("accepte null explicite pour notes et renvoie null", () => {
    const paid = markInvoicePaid(db, INV_ID, Date.now(), "other", null);
    expect(paid.paymentNotes).toBeNull();
  });

  it("accepte une chaîne vide et la persiste telle quelle", () => {
    const paid = markInvoicePaid(db, INV_ID, Date.now(), "cash", "");
    expect(paid.paymentNotes).toBe("");
  });

  it("préserve les notes si la facture est relue après remount DB", () => {
    const notes = "Chèque n°042 — encaissé lundi";
    markInvoicePaid(db, INV_ID, Date.now(), "check", notes);

    const rowDirect = db
      .select({ paymentNotes: invoices.paymentNotes })
      .from(invoices)
      .where(eq(invoices.id, INV_ID))
      .get();

    expect(rowDirect?.paymentNotes).toBe(notes);
  });
});
