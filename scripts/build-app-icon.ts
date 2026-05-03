import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const ROOT = join(import.meta.dir, "..");
const SRC = join(ROOT, "docs/branding/logos/app-icon-source.svg");
const OUT = join(ROOT, "docs/branding/png");

mkdirSync(OUT, { recursive: true });

const svg = readFileSync(SRC, "utf8");
const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: 1024 },
  background: "rgba(0,0,0,0)",
});
const png = resvg.render().asPng();
const out = join(OUT, "app-icon-1024.png");
writeFileSync(out, png);
console.log(`Wrote ${out} (${png.length} bytes)`);
