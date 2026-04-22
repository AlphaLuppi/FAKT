import { describe, expect, it } from "vitest";
import { renderTemplate } from "../renderer.js";
import type { TemplateContext } from "../templates/index.js";

const ctx: TemplateContext = {
  client_name: "Maison Berthe",
  doc_num: "D2026-001",
  amount_ttc_eur: "3 600,00 €",
  due_date_fr: "30 avril 2026",
  workspace_name: "Atelier Mercier",
};

describe("renderTemplate — quote_sent", () => {
  it("substitue les placeholders dans le sujet", () => {
    const { subject } = renderTemplate("quote_sent", ctx);
    expect(subject).toContain("D2026-001");
    expect(subject).toContain("Atelier Mercier");
  });

  it("substitue les placeholders dans le body plain", () => {
    const { bodyPlain } = renderTemplate("quote_sent", ctx);
    expect(bodyPlain).toContain("Maison Berthe");
    expect(bodyPlain).toContain("D2026-001");
    expect(bodyPlain).toContain("3 600,00 €");
    expect(bodyPlain).toContain("Atelier Mercier");
  });

  it("produit un body HTML avec balises", () => {
    const { bodyHtml } = renderTemplate("quote_sent", ctx);
    expect(bodyHtml).toContain("<strong>");
    expect(bodyHtml).toContain("D2026-001");
  });
});

describe("renderTemplate — invoice_sent", () => {
  it("inclut la date d'échéance si fournie", () => {
    const { bodyPlain } = renderTemplate("invoice_sent", ctx);
    expect(bodyPlain).toContain("30 avril 2026");
  });

  it("formule alternative si pas d'échéance", () => {
    const ctxNoDue: TemplateContext = { ...ctx, due_date_fr: undefined };
    const { bodyPlain } = renderTemplate("invoice_sent", ctxNoDue);
    expect(bodyPlain).toContain("conditions mentionnées");
  });
});

describe("renderTemplate — reminder", () => {
  it("mentionne le retard dans le sujet", () => {
    const { subject } = renderTemplate("reminder", ctx);
    expect(subject).toContain("Rappel");
    expect(subject).toContain("D2026-001");
  });

  it("inclut la date d'échéance dans le body", () => {
    const { bodyPlain } = renderTemplate("reminder", ctx);
    expect(bodyPlain).toContain("30 avril 2026");
  });
});

describe("renderTemplate — thanks", () => {
  it("confirme la réception du paiement", () => {
    const { subject } = renderTemplate("thanks", ctx);
    expect(subject).toContain("paiement");
    expect(subject).toContain("D2026-001");
  });

  it("body mentionne la confirmation et le montant", () => {
    const { bodyPlain } = renderTemplate("thanks", ctx);
    expect(bodyPlain).toContain("3 600,00 €");
    expect(bodyPlain).toContain("Maison Berthe");
  });
});
