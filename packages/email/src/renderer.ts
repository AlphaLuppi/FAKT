import type { EmailTemplateKey, TemplateContext, TemplateResult } from "./templates/index.js";
import { quoteSentTemplate } from "./templates/quote_sent.js";
import { invoiceSentTemplate } from "./templates/invoice_sent.js";
import { reminderTemplate } from "./templates/reminder.js";
import { thanksTemplate } from "./templates/thanks.js";

const TEMPLATE_MAP: Record<EmailTemplateKey, (ctx: TemplateContext) => TemplateResult> = {
  quote_sent: quoteSentTemplate,
  invoice_sent: invoiceSentTemplate,
  reminder: reminderTemplate,
  thanks: thanksTemplate,
};

export function renderTemplate(key: EmailTemplateKey, context: TemplateContext): TemplateResult {
  const fn = TEMPLATE_MAP[key];
  return fn(context);
}
