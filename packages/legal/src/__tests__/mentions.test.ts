import { describe, it, expect } from "vitest";
import {
  getMandatoryMentions,
  isVatExempt,
  buildLegalMentionsSnapshot,
  TVA_MENTION_MICRO,
  LUMP_SUM_INDEMNITY,
  LATE_PAYMENT_PENALTY_RATE,
} from "../mentions.js";

describe("TVA_MENTION_MICRO", () => {
  it("contient exactement le texte requis par l'art. 293 B CGI", () => {
    expect(TVA_MENTION_MICRO).toBe("TVA non applicable, art. 293 B du CGI");
  });
});

describe("LUMP_SUM_INDEMNITY", () => {
  it("mentionne les 40€", () => {
    expect(LUMP_SUM_INDEMNITY).toContain("40 €");
  });

  it("référence le décret 2012-1115", () => {
    expect(LUMP_SUM_INDEMNITY).toContain("2012-1115");
  });
});

describe("isVatExempt", () => {
  it("retourne true pour micro-entreprise", () => {
    expect(isVatExempt("micro")).toBe(true);
  });

  it("retourne false pour les assujettis à la TVA", () => {
    expect(isVatExempt("tva")).toBe(false);
  });
});

describe("getMandatoryMentions", () => {
  it("retourne la mention TVA micro exacte", () => {
    const mentions = getMandatoryMentions({ regime: "micro", type: "invoice", amount: 100000 });
    expect(mentions.tvaMention).toBe(TVA_MENTION_MICRO);
  });

  it("inclut l'indemnité forfaitaire 40€ pour une facture", () => {
    const mentions = getMandatoryMentions({ regime: "micro", type: "invoice", amount: 100000 });
    expect(mentions.lumpSumIndemnity).toContain("40 €");
    expect(mentions.documentSpecific).toContain(LUMP_SUM_INDEMNITY);
  });

  it("inclut les pénalités de retard pour une facture", () => {
    const mentions = getMandatoryMentions({ regime: "micro", type: "invoice", amount: 100000 });
    expect(mentions.documentSpecific).toContain(LATE_PAYMENT_PENALTY_RATE);
  });

  it("n'inclut pas les pénalités dans les mentions documentSpecific d'un devis", () => {
    const mentions = getMandatoryMentions({ regime: "micro", type: "quote", amount: 100000 });
    expect(mentions.documentSpecific).toHaveLength(0);
  });

  it("retourne la bonne mention TVA pour régime assujetti", () => {
    const mentions = getMandatoryMentions({ regime: "tva", type: "invoice", amount: 100000 });
    expect(mentions.tvaMention).toBe("TVA applicable");
  });
});

describe("buildLegalMentionsSnapshot", () => {
  const workspace = {
    name: "Tom Andrieu",
    legalForm: "Micro-entreprise" as const,
    siret: "73282932000074",
    address: "1 rue de la Paix, 84000 Avignon",
    iban: "FR76 3000 6000 0112 3456 7890 189",
    tvaMention: TVA_MENTION_MICRO,
  };

  it("inclut le SIRET dans le snapshot", () => {
    const snapshot = buildLegalMentionsSnapshot(workspace);
    expect(snapshot).toContain("73282932000074");
  });

  it("inclut la mention TVA exacte", () => {
    const snapshot = buildLegalMentionsSnapshot(workspace);
    expect(snapshot).toContain(TVA_MENTION_MICRO);
  });

  it("inclut l'IBAN si fourni", () => {
    const snapshot = buildLegalMentionsSnapshot(workspace);
    expect(snapshot).toContain("FR76 3000 6000 0112 3456 7890 189");
  });

  it("n'inclut pas IBAN si null", () => {
    const snapshot = buildLegalMentionsSnapshot({ ...workspace, iban: null });
    expect(snapshot).not.toContain("IBAN");
  });

  it("inclut les pénalités de retard", () => {
    const snapshot = buildLegalMentionsSnapshot(workspace);
    expect(snapshot).toContain("40 €");
  });

  it("utilise les délais de paiement personnalisés", () => {
    const snapshot = buildLegalMentionsSnapshot(workspace, 45);
    expect(snapshot).toContain("45 jours");
  });
});
