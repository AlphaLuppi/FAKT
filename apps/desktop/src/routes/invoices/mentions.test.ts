/**
 * FR-016 — Vérifie que les mentions obligatoires françaises sont bien injectées
 * dans le snapshot DB + dans le DTO InvoiceInput lors de la création.
 *
 * Checklist exhaustive CGI art. 289 + LME art. 21 + D. 2012-1115 :
 * - SIRET + forme juridique + adresse workspace
 * - Numéro facture unique
 * - Date émission + date échéance
 * - Pénalités de retard (3× taux légal)
 * - Indemnité forfaitaire 40 € (obligatoire B2B)
 * - TVA non applicable, art. 293 B du CGI (micro-entreprise)
 * - IBAN (pour virement)
 */

import { describe, it, expect } from "vitest";
import {
  getMandatoryMentions,
  buildLegalMentionsSnapshot,
  TVA_MENTION_MICRO,
  LATE_PAYMENT_PENALTY_RATE,
  LUMP_SUM_INDEMNITY,
  isVatExempt,
} from "@fakt/legal";
import { invoiceSchema } from "@fakt/core";

describe("Mentions légales obligatoires (FR-016)", () => {
  const workspace = {
    name: "Atelier Mercier",
    legalForm: "Micro-entreprise" as const,
    siret: "73282932000074",
    address: "10 rue du Test, 84000 Avignon",
    iban: "FR76 3000 6000 0112 3456 7890 189",
    tvaMention: TVA_MENTION_MICRO,
  };

  it("getMandatoryMentions retourne un objet exhaustif pour micro-entreprise", () => {
    const mentions = getMandatoryMentions({
      regime: "micro",
      type: "invoice",
      amount: 100000,
    });
    expect(mentions.tvaMention).toBe(TVA_MENTION_MICRO);
    expect(mentions.latePenalty).toContain("taux d'intérêt légal");
    expect(mentions.lumpSumIndemnity).toContain("40 €");
    expect(mentions.documentSpecific).toContain(LATE_PAYMENT_PENALTY_RATE);
    expect(mentions.documentSpecific).toContain(LUMP_SUM_INDEMNITY);
  });

  it("isVatExempt vrai pour micro, faux pour assujetti", () => {
    expect(isVatExempt("micro")).toBe(true);
    expect(isVatExempt("tva")).toBe(false);
  });

  it("buildLegalMentionsSnapshot contient SIRET + forme + TVA + IBAN + pénalités + 40€", () => {
    const snapshot = buildLegalMentionsSnapshot(workspace, 30);
    expect(snapshot).toContain(workspace.siret);
    expect(snapshot).toContain(workspace.legalForm);
    expect(snapshot).toContain(workspace.address);
    expect(snapshot).toContain(TVA_MENTION_MICRO);
    expect(snapshot).toContain(workspace.iban);
    expect(snapshot).toContain("40 €");
    expect(snapshot).toContain("Paiement à 30 jours");
  });

  it("InvoiceDto Zod accepte un DTO avec legalMentions non-vide", () => {
    const snapshot = buildLegalMentionsSnapshot(workspace, 30);
    const dto = {
      id: "11111111-1111-4111-8111-111111111111",
      workspaceId: "22222222-2222-4222-8222-222222222222",
      clientId: "33333333-3333-4333-8333-333333333333",
      quoteId: null,
      number: "F2026-001",
      year: 2026,
      sequence: 1,
      kind: "independent" as const,
      depositPercent: null,
      title: "Mission test",
      status: "draft" as const,
      totalHtCents: 100000,
      dueDate: Date.now() + 30 * 86400000,
      paidAt: null,
      paymentMethod: "wire" as const,
      legalMentions: snapshot,
      issuedAt: Date.now(),
      archivedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      items: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          position: 0,
          description: "Ligne test",
          quantity: 1000,
          unitPriceCents: 100000,
          unit: "forfait" as const,
          lineTotalCents: 100000,
          serviceId: null,
        },
      ],
    };
    const parsed = invoiceSchema.safeParse(dto);
    expect(parsed.success).toBe(true);
  });

  it("checklist exhaustive : toutes les mentions FR-016 présentes dans le snapshot", () => {
    const snapshot = buildLegalMentionsSnapshot(workspace, 30);

    // 1. Nom + forme juridique + adresse + SIRET workspace
    expect(snapshot).toContain("Micro-entreprise");
    expect(snapshot).toContain("Atelier Mercier");
    expect(snapshot).toContain("73282932000074");

    // 2. TVA non applicable (art. 293 B CGI)
    expect(snapshot).toContain("TVA non applicable");
    expect(snapshot).toContain("293 B");
    expect(snapshot).toContain("CGI");

    // 3. Pénalités de retard (3× taux légal)
    expect(snapshot).toContain("3 fois le taux");
    expect(snapshot).toContain("intérêt légal");

    // 4. Indemnité forfaitaire 40 € (obligatoire B2B)
    expect(snapshot).toContain("40 €");
    expect(snapshot).toContain("2012-1115");

    // 5. IBAN (pour virement)
    expect(snapshot).toContain("FR76");
    expect(snapshot).toContain("IBAN");

    // 6. Conditions de paiement
    expect(snapshot).toMatch(/Paiement à \d+ jours/);
  });
});
