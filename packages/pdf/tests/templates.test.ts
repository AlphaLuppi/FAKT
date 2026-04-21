/**
 * Test de structure — vérifie que tous les fichiers Typst attendus par le
 * wrapper Rust existent sur disque. C'est un garde-fou contre les renames
 * accidentels qui casseraient `include_str!` côté Rust.
 */
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

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
  });

  it("contient tous les partials attendus", () => {
    expect(exists("partials/header-workspace.typ")).toBe(true);
    expect(exists("partials/header-client.typ")).toBe(true);
    expect(exists("partials/items-table.typ")).toBe(true);
    expect(exists("partials/totals.typ")).toBe(true);
    expect(exists("partials/legal-mentions.typ")).toBe(true);
    expect(exists("partials/signature-block.typ")).toBe(true);
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
});
