/**
 * Script standalone — génère les PDFs de sortie pour revue visuelle.
 *
 * Usage :
 *   bun run tests/generate-outputs.ts
 *
 * Pré-requis : la CLI `typst` doit être dans le PATH (ou FAKT_TYPST_PATH
 * pointer vers un binaire). Sinon le script écrit un message d'erreur et
 * sort avec code 1.
 *
 * Produit :
 *   tests/output/quote-D2026-001.pdf
 *   tests/output/invoice-F2026-001.pdf
 *
 * Ces PDFs sont commités dans le repo pour revue visuelle Tom (DoD Track C).
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  buildInvoiceContext,
  buildQuoteContext,
  type InvoiceCtx,
  type QuoteCtx,
} from "../src/context-builder.ts";

import { clientNominal } from "./fixtures/clients.ts";
import { invoiceSimple } from "./fixtures/invoices.ts";
import { quoteSimple } from "./fixtures/quotes.ts";
import { fixtureWorkspace } from "./fixtures/workspace.ts";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, "..");
const templatesDir = resolve(pkgRoot, "templates");
const outDir = resolve(pkgRoot, "tests", "output");

mkdirSync(outDir, { recursive: true });

function compile(
  templateName: "quote.typ" | "invoice.typ",
  ctx: QuoteCtx | InvoiceCtx,
  outputPath: string,
): void {
  // Le contexte est sérialisé dans un JSON dans le même dossier que les
  // templates pour que `sys.inputs.ctx-path` résolve correctement.
  const ctxPath = resolve(templatesDir, `_generated-ctx-${ctx.kind}.json`);
  writeFileSync(ctxPath, JSON.stringify(ctx, null, 2));

  const binary = process.env["FAKT_TYPST_PATH"] ?? "typst";
  const args = [
    "compile",
    "--root",
    templatesDir,
    "--input",
    `ctx-path=_generated-ctx-${ctx.kind}.json`,
    resolve(templatesDir, templateName),
    outputPath,
  ];

  // eslint-disable-next-line no-console
  console.log(`$ ${binary} ${args.join(" ")}`);
  const r = spawnSync(binary, args, {
    stdio: "inherit",
    cwd: templatesDir,
  });
  if (r.status !== 0) {
    // eslint-disable-next-line no-console
    console.error(
      `Échec de compilation Typst pour ${templateName} — code=${r.status}`,
    );
    process.exit(1);
  }
}

// ─── Quote ──────────────────────────────────────────────────────────────────
const quoteCtx = buildQuoteContext({
  quote: quoteSimple,
  client: clientNominal,
  workspace: fixtureWorkspace,
});
compile("quote.typ", quoteCtx, resolve(outDir, "quote-D2026-001.pdf"));

// ─── Invoice ────────────────────────────────────────────────────────────────
const invoiceCtx = buildInvoiceContext({
  invoice: invoiceSimple,
  client: clientNominal,
  workspace: fixtureWorkspace,
  quoteReference: "D2026-001",
});
compile("invoice.typ", invoiceCtx, resolve(outDir, "invoice-F2026-001.pdf"));

// eslint-disable-next-line no-console
console.log("\nPDFs générés dans", outDir);
