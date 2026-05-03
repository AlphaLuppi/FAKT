/**
 * Test de structure — vérifie que tous les fichiers Typst attendus par le
 * wrapper Rust existent sur disque. C'est un garde-fou contre les renames
 * accidentels qui casseraient `include_str!` côté Rust.
 */
import { readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(here, "..", "templates");

function read(rel: string): string {
  return readFileSync(resolve(templatesDir, rel), "utf8");
}

function exists(rel: string): boolean {
  try {
    return statSync(resolve(templatesDir, rel)).isFile();
  } catch {
    return false;
  }
}

describe("arborescence templates Typst", () => {
  it("contient base.typ + templates principaux", () => {
    expect(exists("base.typ")).toBe(true);
    expect(exists("quote.typ")).toBe(true);
    expect(exists("invoice.typ")).toBe(true);
    expect(exists("audit-trail.typ")).toBe(true);
  });

  it("contient tous les partials attendus", () => {
    expect(exists("partials/header-workspace.typ")).toBe(true);
    expect(exists("partials/header-client.typ")).toBe(true);
    expect(exists("partials/items-table.typ")).toBe(true);
    expect(exists("partials/totals.typ")).toBe(true);
    expect(exists("partials/legal-mentions.typ")).toBe(true);
    expect(exists("partials/signature-block.typ")).toBe(true);
    expect(exists("partials/quote-legal.typ")).toBe(true);
  });
});

describe("charte Brutal Invoice héritée des skills legacy", () => {
  it("base.typ définit la couleur accent #2E5090", () => {
    const base = read("base.typ");
    expect(base).toMatch(/#2E5090/);
  });

  it("quote.typ affiche le numéro D2026-XXX et le titre DEVIS", () => {
    const src = read("quote.typ");
    expect(src).toContain("DEVIS");
    // Le numéro vient du JSON, on vérifie juste la ref field.
    expect(src).toContain("ctx.number");
  });

  it("invoice.typ affiche FACTURE + mentions légales", () => {
    const src = read("invoice.typ");
    expect(src).toContain("FACTURE");
    expect(src).toContain("legal-mentions");
    expect(src).toContain("Mentions légales");
  });

  it("invoice.typ impose mention 'Pas d'escompte'", () => {
    const src = read("invoice.typ");
    expect(src).toContain("Pas d'escompte");
  });

  it("audit-trail.typ rend le titre RAPPORT D'AUDIT et les sections clés", () => {
    const src = read("audit-trail.typ");
    expect(src).toContain("RAPPORT D'AUDIT");
    expect(src).toContain("Document");
    expect(src).toContain("Signatures électroniques");
    expect(src).toContain("Journal d'événements");
    // Référence aux outils PAdES tiers (preuve juridique)
    expect(src).toContain("Adobe Reader");
    expect(src).toContain("pyHanko");
  });
});

describe("mentions légales obligatoires FR — facture", () => {
  it("invoice.typ renvoie aux articles L441-10 et D441-5", () => {
    const src = read("invoice.typ");
    expect(src).toContain("L441-10");
    expect(src).toContain("D441-5");
  });

  it("invoice.typ mentionne l'indemnité forfaitaire de 40 €", () => {
    const src = read("invoice.typ");
    expect(src).toContain("40 €");
    expect(src).toContain("Indemnité forfaitaire");
  });

  it("invoice.typ appelle le bloc modalités de paiement", () => {
    const src = read("invoice.typ");
    expect(src).toContain("Modalités de paiement");
    expect(src).toContain("Virement bancaire");
    expect(src).toContain("IBAN");
  });

  it("header-workspace.typ rend l'adresse, SIRET, TVA mention, email", () => {
    const src = read("partials/header-workspace.typ");
    expect(src).toContain("ws.address");
    expect(src).toContain("SIRET");
    expect(src).toContain("ws.tvaMention");
    expect(src).toContain("ws.email");
  });
});

describe("mentions légales obligatoires FR — devis", () => {
  it("quote.typ importe et appelle le bloc CGV légales", () => {
    const src = read("quote.typ");
    expect(src).toContain("quote-legal");
    expect(src).toContain("Conditions générales");
  });

  it("quote.typ inclut un bloc modalités de paiement", () => {
    const src = read("quote.typ");
    expect(src).toContain("Modalités de paiement");
    expect(src).toContain("Virement bancaire");
  });

  it("quote-legal.typ énumère les CGV non négociables droit français", () => {
    const src = read("partials/quote-legal.typ");
    // Facturation & paiement
    expect(src).toContain("Pénalités de retard");
    expect(src).toContain("L441-10");
    expect(src).toContain("Indemnité forfaitaire");
    expect(src).toContain("D441-5");
    expect(src).toContain("40 €");
    expect(src).toContain("293 B");
    expect(src).toContain("Pas d'escompte");
    // Propriété intellectuelle
    expect(src).toContain("Propriété intellectuelle");
    expect(src).toContain("Cession des droits");
    // Garantie
    expect(src).toContain("Garantie");
    expect(src).toContain("responsabilité");
    // Résiliation
    expect(src).toContain("Résiliation");
    expect(src).toContain("lettre recommandée");
    // Confidentialité
    expect(src).toContain("Confidentialité");
    // Loi applicable
    expect(src).toContain("Loi applicable");
    expect(src).toContain("Droit français");
    // Validité
    expect(src).toContain("Validité");
    expect(src).toContain("90");
  });
});
