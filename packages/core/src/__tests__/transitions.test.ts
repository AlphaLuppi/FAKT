import { describe, expect, it } from "vitest";
import {
  canCreateInvoiceFromQuote,
  canTransitionInvoice,
  canTransitionQuote,
  isInvoiceEditable,
  isInvoiceOverdue,
  isQuoteEditable,
} from "../status/transitions.js";

describe("canTransitionQuote", () => {
  it("autorise draft → sent", () => {
    expect(canTransitionQuote("draft", "sent")).toBe(true);
  });

  it("autorise sent → signed", () => {
    expect(canTransitionQuote("sent", "signed")).toBe(true);
  });

  it("autorise sent → refused", () => {
    expect(canTransitionQuote("sent", "refused")).toBe(true);
  });

  it("interdit draft → signed (transition directe)", () => {
    expect(canTransitionQuote("draft", "signed")).toBe(false);
  });

  it("interdit signed → draft ou sent (pas de rollback)", () => {
    expect(canTransitionQuote("signed", "sent")).toBe(false);
    expect(canTransitionQuote("signed", "draft")).toBe(false);
  });

  it("autorise signed → invoiced (cycle facturation H2→H3)", () => {
    expect(canTransitionQuote("signed", "invoiced")).toBe(true);
  });

  it("autorise sent → invoiced (facturation directe sans signature)", () => {
    expect(canTransitionQuote("sent", "invoiced")).toBe(true);
  });

  it("autorise sent → draft (annulation d'envoi manuel, aucun email envoye)", () => {
    // Depuis 2026-04-24 : le bouton "Marque comme envoye" est manuel (pas
    // d'integration email reelle en MVP), donc l'utilisateur peut defaire
    // l'action sans consequence legale. Le numero d'emission reste attribue.
    expect(canTransitionQuote("sent", "draft")).toBe(true);
  });

  it("interdit invoiced → tout autre statut (terminal)", () => {
    expect(canTransitionQuote("invoiced", "signed")).toBe(false);
    expect(canTransitionQuote("invoiced", "draft")).toBe(false);
    expect(canTransitionQuote("invoiced", "sent")).toBe(false);
  });

  it("interdit refused → tout autre statut (terminal)", () => {
    expect(canTransitionQuote("refused", "sent")).toBe(false);
  });
});

describe("canTransitionInvoice", () => {
  it("autorise draft → sent", () => {
    expect(canTransitionInvoice("draft", "sent")).toBe(true);
  });

  it("autorise sent → paid", () => {
    expect(canTransitionInvoice("sent", "paid")).toBe(true);
  });

  it("autorise overdue → paid", () => {
    expect(canTransitionInvoice("overdue", "paid")).toBe(true);
  });

  it("interdit paid → tout autre statut (terminal)", () => {
    expect(canTransitionInvoice("paid", "sent")).toBe(false);
    expect(canTransitionInvoice("paid", "overdue")).toBe(false);
  });
});

describe("canCreateInvoiceFromQuote", () => {
  it("autorise la conversion depuis un devis signé", () => {
    expect(canCreateInvoiceFromQuote("signed")).toBe(true);
  });

  it("interdit la conversion depuis tout autre statut", () => {
    expect(canCreateInvoiceFromQuote("draft")).toBe(false);
    expect(canCreateInvoiceFromQuote("sent")).toBe(false);
    expect(canCreateInvoiceFromQuote("refused")).toBe(false);
  });
});

describe("isQuoteEditable", () => {
  it("retourne true pour un devis en draft", () => {
    expect(isQuoteEditable("draft")).toBe(true);
  });

  it("retourne false pour tous les autres statuts", () => {
    expect(isQuoteEditable("sent")).toBe(false);
    expect(isQuoteEditable("signed")).toBe(false);
    expect(isQuoteEditable("refused")).toBe(false);
    expect(isQuoteEditable("expired")).toBe(false);
  });
});

describe("isInvoiceEditable", () => {
  it("retourne true pour une facture en draft", () => {
    expect(isInvoiceEditable("draft")).toBe(true);
  });

  it("retourne false pour les factures émises", () => {
    expect(isInvoiceEditable("sent")).toBe(false);
    expect(isInvoiceEditable("paid")).toBe(false);
    expect(isInvoiceEditable("overdue")).toBe(false);
  });
});

describe("isInvoiceOverdue", () => {
  it("retourne false pour une facture payée", () => {
    const pastDate = Date.now() - 1000 * 60 * 60 * 24; // hier
    expect(isInvoiceOverdue(pastDate, "paid")).toBe(false);
  });

  it("retourne false si pas de date d'échéance", () => {
    expect(isInvoiceOverdue(null, "sent")).toBe(false);
  });

  it("retourne true si la date d'échéance est passée", () => {
    const pastDate = Date.now() - 1000 * 60 * 60 * 24; // hier
    expect(isInvoiceOverdue(pastDate, "sent")).toBe(true);
  });

  it("retourne false si la date d'échéance est future", () => {
    const futureDate = Date.now() + 1000 * 60 * 60 * 24; // demain
    expect(isInvoiceOverdue(futureDate, "sent")).toBe(false);
  });
});
