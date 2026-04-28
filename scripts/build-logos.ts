import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";

const ROOT = join(import.meta.dir, "..");
const SRC = join(ROOT, "docs/branding/logos");
const OUT = join(ROOT, "docs/branding/png");

mkdirSync(OUT, { recursive: true });

const sources = [
  { file: "v1-a-original.svg", sizes: [1024, 512] },
  { file: "v1-b-yellow-fill.svg", sizes: [1024, 512, 256, 128, 64, 32] },
  { file: "v1-c-inverse.svg", sizes: [1024, 512] },
  { file: "v1-d-tight-mark.svg", sizes: [1024, 512, 256, 128, 64, 32, 16] },
  { file: "v1-e-lockup-vertical.svg", sizes: [1024, 512] },
  { file: "v1-f-lockup-horizontal.svg", sizes: [2048, 1024, 512] },
];

for (const { file, sizes } of sources) {
  const svg = readFileSync(join(SRC, file), "utf8");
  const stem = basename(file, ".svg");
  for (const size of sizes) {
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: size },
      background: "rgba(0,0,0,0)",
    });
    const png = resvg.render().asPng();
    const outPath = join(OUT, `${stem}-${size}.png`);
    writeFileSync(outPath, png);
    console.log(`  ${stem}-${size}.png  (${png.length} bytes)`);
  }
}

console.log("\nDone.");
