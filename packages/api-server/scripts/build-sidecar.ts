#!/usr/bin/env bun
/**
 * Compile `packages/api-server/src/index.ts` en binaire standalone via
 * `bun build --compile` pour les 4 targets supportées par Tauri :
 *
 *   Tauri target triple                          | Bun --target
 *   ---------------------------------------------|---------------------
 *   x86_64-pc-windows-msvc                       | bun-windows-x64
 *   x86_64-apple-darwin                          | bun-darwin-x64
 *   aarch64-apple-darwin                         | bun-darwin-arm64
 *   x86_64-unknown-linux-gnu                     | bun-linux-x64
 *
 * Les binaires sortent dans `apps/desktop/src-tauri/binaries/fakt-api-<triple>[.exe]`.
 * Tauri résout ensuite `fakt-api` vers le bon triple au bundling (voir
 * `tauri.conf.json` → `bundle.externalBin`).
 *
 * Par défaut, on compile uniquement pour le target courant (rapide en dev).
 * Pour compiler les 4 : `bun run build:sidecar --all`.
 * Pour un target spécifique : `bun run build:sidecar --target=<bun-target>`.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { arch as processArch, platform } from "node:process";

type Triple = {
  bunTarget: string;
  rustTriple: string;
  ext: string;
};

const ALL_TARGETS: Triple[] = [
  { bunTarget: "bun-windows-x64", rustTriple: "x86_64-pc-windows-msvc", ext: ".exe" },
  { bunTarget: "bun-darwin-x64", rustTriple: "x86_64-apple-darwin", ext: "" },
  { bunTarget: "bun-darwin-arm64", rustTriple: "aarch64-apple-darwin", ext: "" },
  { bunTarget: "bun-linux-x64", rustTriple: "x86_64-unknown-linux-gnu", ext: "" },
];

function currentTarget(): Triple {
  if (platform === "win32") return ALL_TARGETS[0];
  if (platform === "darwin") {
    return processArch === "arm64" ? ALL_TARGETS[2] : ALL_TARGETS[1];
  }
  if (platform === "linux") return ALL_TARGETS[3];
  throw new Error(`plateforme non supportée: ${platform}/${processArch}`);
}

function parseArgs(): { targets: Triple[] } {
  const argv = process.argv.slice(2);
  if (argv.includes("--all")) return { targets: ALL_TARGETS };
  const explicit = argv.find((a) => a.startsWith("--target="));
  if (explicit) {
    const wanted = explicit.split("=")[1];
    const hit = ALL_TARGETS.find((t) => t.bunTarget === wanted);
    if (!hit) {
      throw new Error(
        `target inconnu: ${wanted}. Valides: ${ALL_TARGETS.map((t) => t.bunTarget).join(", ")}`,
      );
    }
    return { targets: [hit] };
  }
  return { targets: [currentTarget()] };
}

function ensureDir(p: string): void {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function formatSize(bytes: number): string {
  if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes > 1_000) return `${(bytes / 1_000).toFixed(1)} kB`;
  return `${bytes} B`;
}

function buildOne(target: Triple, entry: string, outDir: string): void {
  ensureDir(outDir);
  const outfile = resolve(outDir, `fakt-api-${target.rustTriple}${target.ext}`);
  const cmd = "bun";
  const args = [
    "build",
    "--compile",
    "--minify",
    `--target=${target.bunTarget}`,
    entry,
    "--outfile",
    outfile,
  ];
  console.log(`\n[build-sidecar] ${target.bunTarget} → ${outfile}`);
  const res = spawnSync(cmd, args, { stdio: "inherit" });
  if (res.status !== 0) {
    throw new Error(
      `bun build a échoué pour ${target.bunTarget} (exit=${res.status ?? "signal"})`,
    );
  }
  const size = statSync(outfile).size;
  console.log(`[build-sidecar] OK ${target.bunTarget} — taille: ${formatSize(size)}`);
  const MAX_BYTES = 100 * 1024 * 1024;
  if (size > MAX_BYTES) {
    console.warn(
      `[build-sidecar] WARNING taille > 100 MB (${formatSize(size)}) — voir NFR-003`,
    );
  }
}

function main(): void {
  const { targets } = parseArgs();

  const thisFile = new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  const packageRoot = resolve(dirname(thisFile), "..");
  const repoRoot = resolve(packageRoot, "..", "..");

  const entry = resolve(packageRoot, "src", "index.ts");
  if (!existsSync(entry)) {
    console.error(
      `[build-sidecar] entry introuvable: ${entry}\n` +
        "  → Track α doit avoir livré packages/api-server/src/index.ts avant.",
    );
    process.exit(2);
  }

  const outDir = resolve(repoRoot, "apps", "desktop", "src-tauri", "binaries");

  console.log("[build-sidecar] entry:", entry);
  console.log("[build-sidecar] outDir:", outDir);
  console.log(
    "[build-sidecar] targets:",
    targets.map((t) => t.bunTarget).join(", "),
  );

  for (const target of targets) {
    buildOne(target, entry, outDir);
  }

  console.log("\n[build-sidecar] done ✓");
}

main();
