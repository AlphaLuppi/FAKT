export type EmailTemplateKey = "quote_sent" | "invoice_sent" | "reminder" | "thanks";

export interface TemplateContext {
  client_name: string;
  doc_num: string;
  amount_ttc_eur: string;
  due_date_fr?: string | undefined;
  workspace_name: string;
}

export interface TemplateResult {
  subject: string;
  bodyPlain: string;
  bodyHtml: string;
}

export { quoteSentTemplate } from "./quote_sent.js";
export { invoiceSentTemplate } from "./invoice_sent.js";
export { reminderTemplate } from "./reminder.js";
export { thanksTemplate } from "./thanks.js";
