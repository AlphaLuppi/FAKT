import tailwind from "@astrojs/tailwind";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://fakt.alphaluppi.com",
  output: "static",
  integrations: [tailwind()],
});
