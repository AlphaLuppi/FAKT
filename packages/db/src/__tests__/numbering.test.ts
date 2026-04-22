import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb, seedWorkspace, WORKSPACE_ID } from "./helpers.js";
import {
  nextQuoteNumber,
  nextInvoiceNumber,
  peekNextNumber,
  nextNumberAtomic,
} from "../queries/numbering.js";
import type { TestDb } from "./helpers.js";

let db: TestDb;
let sqlite: Database.Database;

beforeEach(() => {
  ({ db, sqlite } = createTestDb());
  seedWorkspace(db);
});

describe("nextQuoteNumber", () => {
  it("retourne D{année}-001 pour le premier devis", () => {
    const result = nextQuoteNumber(db, WORKSPACE_ID);
    const year = new Date().getFullYear();
    expect(result.sequence).toBe(1);
    expect(result.year).toBe(year);
    expect(result.formatted).toBe(`D${year}-001`);
  });

  it("incrémente séquentiellement", () => {
    const r1 = nextQuoteNumber(db, WORKSPACE_ID);
    const r2 = nextQuoteNumber(db, WORKSPACE_ID);
    expect(r2.sequence).toBe(r1.sequence + 1);
  });

  it("séquence 10 créations consécutives → 001-010 continue", () => {
    const sequences: number[] = [];
    for (let i = 0; i < 10; i++) {
      sequences.push(nextQuoteNumber(db, WORKSPACE_ID).sequence);
    }
    expect(sequences).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe("nextInvoiceNumber", () => {
  it("retourne F{année}-001 pour la première facture", () => {
    const result = nextInvoiceNumber(db, WORKSPACE_ID);
    const year = new Date().getFullYear();
    expect(result.formatted).toBe(`F${year}-001`);
  });

  it("séquences devis et factures sont indépendantes", () => {
    const q = nextQuoteNumber(db, WORKSPACE_ID);
    const f = nextInvoiceNumber(db, WORKSPACE_ID);
    expect(q.sequence).toBe(1);
    expect(f.sequence).toBe(1);
  });

  it("10 factures séquentielles → séquence 001-010", () => {
    const seqs: number[] = [];
    for (let i = 0; i < 10; i++) {
      seqs.push(nextInvoiceNumber(db, WORKSPACE_ID).sequence);
    }
    expect(seqs).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe("intégrité numérotation mixte", () => {
  it("10 devis + 10 factures → deux séquences continues 001-010", () => {
    const quoteSeqs: number[] = [];
    const invoiceSeqs: number[] = [];

    for (let i = 0; i < 10; i++) {
      quoteSeqs.push(nextQuoteNumber(db, WORKSPACE_ID).sequence);
      invoiceSeqs.push(nextInvoiceNumber(db, WORKSPACE_ID).sequence);
    }

    expect(quoteSeqs).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(invoiceSeqs).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe("peekNextNumber", () => {
  it("retourne le prochain numéro sans l'incrémenter", () => {
    const peek = peekNextNumber(db, WORKSPACE_ID, "quote");
    expect(peek.sequence).toBe(1);
    // Le peek ne doit pas avoir incrémenté le compteur
    const next = nextQuoteNumber(db, WORKSPACE_ID);
    expect(next.sequence).toBe(1);
  });
});

describe("nextNumberAtomic", () => {
  it("incrémente séquentiellement via BEGIN IMMEDIATE", () => {
    const r1 = nextNumberAtomic(sqlite, db, WORKSPACE_ID, "quote");
    const r2 = nextNumberAtomic(sqlite, db, WORKSPACE_ID, "quote");
    expect(r1.sequence).toBe(1);
    expect(r2.sequence).toBe(2);
  });

  it("quote et invoice indépendants en atomique", () => {
    const q = nextNumberAtomic(sqlite, db, WORKSPACE_ID, "quote");
    const f = nextNumberAtomic(sqlite, db, WORKSPACE_ID, "invoice");
    expect(q.sequence).toBe(1);
    expect(f.sequence).toBe(1);
    expect(q.formatted).toMatch(/^D\d{4}-001$/);
    expect(f.formatted).toMatch(/^F\d{4}-001$/);
  });
});
