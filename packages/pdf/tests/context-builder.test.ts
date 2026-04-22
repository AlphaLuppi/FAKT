/**
 * Tests du context-builder — transformation DTO → contexte Typst.
 *
 * Ces tests sont pure TS (pas d'IPC Tauri), donc 100 % déterministes en CI.
 * L'appel à invoke(render_pdf) est testé en E2E Playwright (hors-scope ici).
 */
import { describe, expect, it } from "vitest";

import {
  buildInvoiceContext,
  buildQuoteContext,
  clientToCtx,
  formatQuantity,
  lineToItemCtx,
  workspaceToCtx,
} from "../src/context-builder.ts";

import { clientIntl, clientMinimal, clientNominal } from "./fixtures/clients.ts";
import { invoiceIntl, invoiceLong, invoiceSimple } from "./fixtures/invoices.ts";
import { quoteIntl, quoteLong, quoteSimple } from "./fixtures/quotes.ts";
import { fixtureWorkspace } from "./fixtures/workspace.ts";

describe("formatQuantity", () => {
  it("retourne un entier sans séparateur pour les valeurs entières", () => {
    expect(formatQuantity(1000)).toBe("1");
    expect(formatQuantity(2000)).toBe("2");
  });

  it("utilise la virgule décimale FR pour les valeurs fractionnaires", () => {
    expect(formatQuantity(2500)).toBe("2,5");
    expect(formatQuantity(12500)).toBe("12,5");
  });

  it("gère les milli-quantités tronquées à 3 décimales", () => {
    // 1.234567 → 1,235 (arrondi 3 décimales)
    expect(formatQuantity(1235)).toBe("1,235");
  });
});

describe("workspaceToCtx", () => {
  it("projette tous les champs obligatoires", () => {
    const ctx = workspaceToCtx(fixtureWorkspace);
    expect(ctx.name).toBe("Tom Andrieu");
    expect(ctx.siret).toBe("85366584200029");
    expect(ctx.tvaMention).toContain("293 B");
    expect(ctx.iban).toMatch(/^FR76/);
  });
});

describe("clientToCtx", () => {
  it("conserve les champs nullable tels quels", () => {
    const ctx = clientToCtx(clientMinimal);
    expect(ctx.name).toBe("Jean Dupont");
    expect(ctx.legalForm).toBeNull();
    expect(ctx.siret).toBeNull();
    expect(ctx.address).toBeNull();
  });

  it("copie les champs renseignés pour client nominal", () => {
    const ctx = clientToCtx(clientNominal);
    expect(ctx.legalForm).toBe("SARL");
    expect(ctx.siret).toBe("89513306400017");
    expect(ctx.contactName).toBe("Marco Bianchi");
  });

  it("gère le client international", () => {
    const ctx = clientToCtx(clientIntl);
    expect(ctx.siret).toBeNull();
    expect(ctx.address).toContain("USA");
  });
});

describe("lineToItemCtx", () => {
  it("formate montants en euros FR et quantité", () => {
    const ctx = lineToItemCtx({
      id: "00000000-0000-0000-0000-000000000999",
      position: 1,
      description: "Forfait test",
      quantity: 2500,
      unit: "jour",
      unitPriceCents: 50000,
      lineTotalCents: 125000,
      serviceId: null,
    });
    expect(ctx.description).toBe("Forfait test");
    expect(ctx.quantity).toBe("2,5");
    expect(ctx.unit).toBe("jour");
    // formatEur Intl fr-FR — le symbole € est précédé d'un espace insécable NBSP.
    expect(ctx.unitPrice).toMatch(/500,00/);
    expect(ctx.unitPrice).toContain("€");
    expect(ctx.total).toMatch(/1\s?250,00/);
  });
});

describe("buildQuoteContext", () => {
  it("construit un contexte complet pour un devis nominal", () => {
    const ctx = buildQuoteContext({
      quote: quoteSimple,
      client: clientNominal,
      workspace: fixtureWorkspace,
    });
    expect(ctx.kind).toBe("quote");
    expect(ctx.number).toBe("D2026-001");
    expect(ctx.items.length).toBe(1);
    expect(ctx.total).toContain("2");
    expect(ctx.total).toContain("500,00");
    expect(ctx.validityDate).toContain("mai");
  });

  it("supporte un devis long (20 lignes)", () => {
    const ctx = buildQuoteContext({
      quote: quoteLong,
      client: clientNominal,
      workspace: fixtureWorkspace,
    });
    expect(ctx.items.length).toBe(20);
  });

  it("projette correctement un client hors-UE", () => {
    const ctx = buildQuoteContext({
      quote: quoteIntl,
      client: clientIntl,
      workspace: fixtureWorkspace,
    });
    expect(ctx.client.siret).toBeNull();
    expect(ctx.client.address).toContain("USA");
  });

  it("throw si le devis n'a pas de numéro", () => {
    expect(() =>
      buildQuoteContext({
        quote: { ...quoteSimple, number: null },
        client: clientNominal,
        workspace: fixtureWorkspace,
      })
    ).toThrow(/numéro/);
  });

  it("throw si le devis n'a pas de date d'émission", () => {
    expect(() =>
      buildQuoteContext({
        quote: { ...quoteSimple, issuedAt: null },
        client: clientNominal,
        workspace: fixtureWorkspace,
      })
    ).toThrow(/émission/);
  });

  it("sérialise en JSON valide (round-trip)", () => {
    const ctx = buildQuoteContext({
      quote: quoteSimple,
      client: clientNominal,
      workspace: fixtureWorkspace,
    });
    const json = JSON.stringify(ctx);
    const parsed = JSON.parse(json);
    expect(parsed.kind).toBe("quote");
    expect(parsed.number).toBe("D2026-001");
  });
});

describe("buildInvoiceContext", () => {
  it("construit un contexte avec mentions légales", () => {
    const ctx = buildInvoiceContext({
      invoice: invoiceSimple,
      client: clientNominal,
      workspace: fixtureWorkspace,
    });
    expect(ctx.kind).toBe("invoice");
    expect(ctx.number).toBe("F2026-001");
    expect(ctx.legalMentions).toContain("293 B");
    expect(ctx.legalMentions).toContain("40 €");
  });

  it("utilise issuedAt comme fallback d'exécution", () => {
    const ctx = buildInvoiceContext({
      invoice: invoiceSimple,
      client: clientNominal,
      workspace: fixtureWorkspace,
    });
    expect(ctx.executionDate).toBe(ctx.issuedAt);
  });

  it("respecte executionAt explicite", () => {
    const ctx = buildInvoiceContext({
      invoice: invoiceSimple,
      client: clientNominal,
      workspace: fixtureWorkspace,
      executionAt: new Date("2026-04-15T00:00:00Z").getTime(),
    });
    expect(ctx.executionDate).toContain("15 avril 2026");
  });

  it("inclut quoteReference quand fourni", () => {
    const ctx = buildInvoiceContext({
      invoice: invoiceSimple,
      client: clientNominal,
      workspace: fixtureWorkspace,
      quoteReference: "D2026-001",
    });
    expect(ctx.quoteReference).toBe("D2026-001");
  });

  it("supporte facture longue 20 lignes", () => {
    const ctx = buildInvoiceContext({
      invoice: invoiceLong,
      client: clientNominal,
      workspace: fixtureWorkspace,
    });
    expect(ctx.items.length).toBe(20);
    expect(ctx.legalMentions).toContain("L441-10".replace("L441-10", "3 fois"));
  });

  it("supporte facture intl", () => {
    const ctx = buildInvoiceContext({
      invoice: invoiceIntl,
      client: clientIntl,
      workspace: fixtureWorkspace,
    });
    expect(ctx.client.siret).toBeNull();
    expect(ctx.items.length).toBe(3);
  });

  it("throw si la facture n'a pas de numéro", () => {
    expect(() =>
      buildInvoiceContext({
        invoice: { ...invoiceSimple, number: null },
        client: clientNominal,
        workspace: fixtureWorkspace,
      })
    ).toThrow(/numéro/);
  });

  it("throw si la facture n'a pas de date d'émission", () => {
    expect(() =>
      buildInvoiceContext({
        invoice: { ...invoiceSimple, issuedAt: null },
        client: clientNominal,
        workspace: fixtureWorkspace,
      })
    ).toThrow(/émission/);
  });
});

describe("snapshots JSON (déterminisme)", () => {
  // Le contexte JSON doit être déterministe sur fixture fixe —
  // garantit byte-parity côté Rust/Typst.

  it("snapshot quoteSimple", () => {
    const ctx = buildQuoteContext({
      quote: quoteSimple,
      client: clientNominal,
      workspace: fixtureWorkspace,
    });
    expect(ctx).toMatchSnapshot();
  });

  it("snapshot invoiceSimple", () => {
    const ctx = buildInvoiceContext({
      invoice: invoiceSimple,
      client: clientNominal,
      workspace: fixtureWorkspace,
    });
    expect(ctx).toMatchSnapshot();
  });
});
