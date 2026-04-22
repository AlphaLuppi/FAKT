/**
 * Test d'intégration — vérifie que la CLI Typst compile effectivement les
 * templates FAKT sans erreur quand elle est disponible dans le PATH.
 *
 * Le test est **skippé** si Typst n'est pas installé (CI-friendly : la
 * suite n'échoue pas par manque d'outil externe).
 *
 * But : garde-fou contre une régression de syntaxe Typst (par ex. l'API
 * `sys.inputs` change de nom entre versions).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildInvoiceContext, buildQuoteContext } from "../src/context-builder.ts";
import { clientNominal } from "./fixtures/clients.ts";
import { invoiceSimple } from "./fixtures/invoices.ts";
import { quoteSimple } from "./fixtures/quotes.ts";
import { fixtureWorkspace } from "./fixtures/workspace.ts";

const here = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(here, "..", "templates");

function hasTypst(): boolean {
  const binary = process.env.FAKT_TYPST_PATH ?? "typst";
  const r = spawnSync(binary, ["--version"], { stdio: "pipe" });
  return r.status === 0;
}

const shouldRun = hasTypst();

describe.skipIf(!shouldRun)("Intégration Typst CLI", () => {
  it("compile quote.typ vers un PDF valide", () => {
    const tmp = mkdtempSync(resolve(tmpdir(), "fakt-pdf-"));
    const ctx = buildQuoteContext({
      quote: quoteSimple,
      client: clientNominal,
      workspace: fixtureWorkspace,
    });
    const ctxPath = resolve(templatesDir, "_test-ctx-quote.json");
    writeFileSync(ctxPath, JSON.stringify(ctx));

    const out = resolve(tmp, "out.pdf");
    const binary = process.env.FAKT_TYPST_PATH ?? "typst";
    const r = spawnSync(
      binary,
      [
        "compile",
        "--root",
        templatesDir,
        "--input",
        "ctx-path=_test-ctx-quote.json",
        resolve(templatesDir, "quote.typ"),
        out,
      ],
      { stdio: "pipe", cwd: templatesDir }
    );

    // Cleanup JSON temp file before assertions (pattern "finally").
    try {
      if (existsSync(ctxPath)) {
        const { unlinkSync } = require("node:fs");
        unlinkSync(ctxPath);
      }
    } catch {
      /* non bloquant */
    }

    expect(r.status).toBe(0);
    expect(existsSync(out)).toBe(true);
    const bytes = readFileSync(out);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("compile invoice.typ vers un PDF valide avec mentions", () => {
    const tmp = mkdtempSync(resolve(tmpdir(), "fakt-pdf-"));
    const ctx = buildInvoiceContext({
      invoice: invoiceSimple,
      client: clientNominal,
      workspace: fixtureWorkspace,
      quoteReference: "D2026-001",
    });
    const ctxPath = resolve(templatesDir, "_test-ctx-invoice.json");
    writeFileSync(ctxPath, JSON.stringify(ctx));

    const out = resolve(tmp, "out.pdf");
    const binary = process.env.FAKT_TYPST_PATH ?? "typst";
    const r = spawnSync(
      binary,
      [
        "compile",
        "--root",
        templatesDir,
        "--input",
        "ctx-path=_test-ctx-invoice.json",
        resolve(templatesDir, "invoice.typ"),
        out,
      ],
      { stdio: "pipe", cwd: templatesDir }
    );

    try {
      if (existsSync(ctxPath)) {
        const { unlinkSync } = require("node:fs");
        unlinkSync(ctxPath);
      }
    } catch {
      /* non bloquant */
    }

    expect(r.status).toBe(0);
    expect(existsSync(out)).toBe(true);
    const bytes = readFileSync(out);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    // Taille raisonnable (> 1 KB car PDF Typst ≈ 60 KB).
    expect(bytes.length).toBeGreaterThan(1024);
  });
});

describe.skipIf(shouldRun)("Intégration Typst CLI (skippé - binaire absent)", () => {
  it("doit signaler l'absence de typst sans échec", () => {
    // Note informationnelle pour le dev : installer via `cargo install typst-cli`.
    expect(true).toBe(true);
  });
});
