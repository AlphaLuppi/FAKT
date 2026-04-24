/**
 * Déclaration TS pour l'import `?url` de Vite vers le worker pdfjs-dist.
 * Vite transforme ce specifier au build en une URL publique vers l'asset.
 * En environnement Node/test l'import throw — code runtime doit catch.
 */
declare module "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url" {
  const url: string;
  export default url;
}
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs?url" {
  const url: string;
  export default url;
}
