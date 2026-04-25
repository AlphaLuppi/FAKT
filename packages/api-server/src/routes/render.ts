import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types.js";

/**
 * Endpoint render PDF serveur — utilisé par le frontend en mode web (mode 2 self-host
 * + mode 3 SaaS). Sur desktop, le frontend appelle directement la commande Tauri
 * `render_pdf` qui shell-out vers Typst CLI local.
 *
 * Contrat strictement compatible avec la commande Tauri :
 *   - Input  : { docType: "quote" | "invoice", dataJson: string }
 *   - Output : application/pdf bytes
 *
 * Sécurité :
 *   - Auth obligatoire (middleware /api/* en amont).
 *   - JSON parsé côté serveur pour valider la shape avant de l'écrire en tempdir.
 *   - Templates copiés depuis un répertoire read-only (pas de path traversal).
 *   - `spawn` (pas de shell) → pas d'injection.
 *   - Tempdir nettoyé après chaque rendu (try/finally).
 *
 * Templates :
 *   - Résolution via env `FAKT_PDF_TEMPLATES_DIR` (Dockerfile : `/app/templates`).
 *   - Fallback dev : remonte depuis `import.meta.url` vers `packages/pdf/templates`.
 */

const renderSchema = z.object({
  docType: z.enum(["quote", "invoice"]),
  dataJson: z.string().min(2),
});

const TYPST_BIN = process.env.FAKT_TYPST_PATH ?? "typst";

const TEMPLATE_FILES: readonly string[] = [
  "base.typ",
  "quote.typ",
  "invoice.typ",
  "partials/header-workspace.typ",
  "partials/header-client.typ",
  "partials/items-table.typ",
  "partials/totals.typ",
  "partials/legal-mentions.typ",
  "partials/signature-block.typ",
  "partials/quote-legal.typ",
];

let cachedTemplatesDir: string | null = null;

function resolveTemplatesDir(): string {
  if (cachedTemplatesDir) return cachedTemplatesDir;
  const fromEnv = process.env.FAKT_PDF_TEMPLATES_DIR;
  if (fromEnv && existsSync(join(fromEnv, "base.typ"))) {
    cachedTemplatesDir = fromEnv;
    return fromEnv;
  }
  // Dev local : remonte depuis dist/routes/render.js → packages/pdf/templates
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "..", "..", "..", "pdf", "templates"),
    join(here, "..", "..", "..", "..", "pdf", "templates"),
    join(here, "..", "..", "..", "..", "..", "packages", "pdf", "templates"),
    "/app/templates",
  ];
  for (const c of candidates) {
    if (existsSync(join(c, "base.typ"))) {
      cachedTemplatesDir = c;
      return c;
    }
  }
  throw new Error(
    "Templates Typst introuvables. Définir FAKT_PDF_TEMPLATES_DIR ou installer @fakt/pdf."
  );
}

async function copyTemplatesTo(dest: string): Promise<void> {
  const src = resolveTemplatesDir();
  await mkdir(join(dest, "partials"), { recursive: true });
  for (const rel of TEMPLATE_FILES) {
    await copyFile(join(src, rel), join(dest, rel));
  }
}

async function runTypst(root: string, mainTemplate: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      TYPST_BIN,
      ["compile", "--root", root, "--input", "ctx-path=ctx.json", mainTemplate, outPath],
      { cwd: root }
    );

    let stderr = "";
    let stdout = "";
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    proc.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        reject(new Error(`Typst CLI introuvable (${TYPST_BIN}). Installez Typst.`));
      } else {
        reject(err);
      }
    });
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const msg = stderr.trim() || stdout.trim() || `typst exit ${code}`;
      reject(new Error(msg));
    });
  });
}

export const renderRoutes = new Hono<AppEnv>();

/**
 * POST /api/render/pdf
 *
 * Body : { docType: "quote" | "invoice", dataJson: string }
 * Réponse : application/pdf (bytes)
 */
renderRoutes.post("/pdf", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "JSON body invalide" } }, 400);
  }

  const parsed = renderSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues.map((i) => i.message).join("; "),
        },
      },
      400
    );
  }

  // Validation supplémentaire : dataJson doit être du JSON parsable.
  try {
    JSON.parse(parsed.data.dataJson);
  } catch {
    return c.json(
      { error: { code: "VALIDATION_ERROR", message: "dataJson n'est pas du JSON valide" } },
      400
    );
  }

  const { docType, dataJson } = parsed.data;
  const tmp = await mkdtemp(join(tmpdir(), "fakt-render-"));

  try {
    await copyTemplatesTo(tmp);
    await writeFile(join(tmp, "ctx.json"), dataJson, "utf8");

    const outPath = join(tmp, "out.pdf");
    const mainTpl = `${docType}.typ`;
    await runTypst(tmp, mainTpl, outPath);

    const pdfBytes = await readFile(outPath);

    // Sanity check — un PDF doit commencer par "%PDF-".
    if (pdfBytes.length < 5 || pdfBytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
      return c.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Sortie Typst invalide (pas un PDF)",
          },
        },
        500
      );
    }

    return c.body(pdfBytes, 200, {
      "Content-Type": "application/pdf",
      "Content-Length": pdfBytes.length.toString(),
      "Cache-Control": "no-store",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: { code: "INTERNAL_ERROR", message: `Échec rendu PDF: ${msg}` } }, 500);
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {
      // pas critique : tempdir
    });
  }
});

// Pour debug/admin : lister les templates résolus.
renderRoutes.get("/templates", async (c) => {
  try {
    const dir = resolveTemplatesDir();
    const top = await readdir(dir);
    return c.json({ dir, files: top });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: { code: "INTERNAL_ERROR", message: msg } }, 500);
  }
});
