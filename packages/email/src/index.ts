export type { EmlAttachment, EmlOptions } from "./eml-builder.js";
export { buildEml } from "./eml-builder.js";

export type { MailtoOptions } from "./mailto-fallback.js";
export { buildMailtoUrl } from "./mailto-fallback.js";

export type { EmailTemplateKey, TemplateContext, TemplateResult } from "./templates/index.js";
export { renderTemplate } from "./renderer.js";
