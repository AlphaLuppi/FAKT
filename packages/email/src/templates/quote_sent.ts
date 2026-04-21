import type { TemplateContext, TemplateResult } from "./index.js";

export function quoteSentTemplate(ctx: TemplateContext): TemplateResult {
  const subject = `Devis ${ctx.doc_num} — ${ctx.workspace_name}`;
  const bodyPlain = `Bonjour ${ctx.client_name},

Veuillez trouver ci-joint le devis ${ctx.doc_num} d'un montant de ${ctx.amount_ttc_eur} TTC.

Ce devis est valable 30 jours à compter de sa date d'émission. Pour l'accepter, il vous suffit de me retourner ce document signé.

N'hésitez pas à me contacter si vous avez des questions ou souhaitez apporter des modifications.

Cordialement,
${ctx.workspace_name}`;

  const bodyHtml = `<p>Bonjour ${ctx.client_name},</p>
<p>Veuillez trouver ci-joint le devis <strong>${ctx.doc_num}</strong> d'un montant de <strong>${ctx.amount_ttc_eur} TTC</strong>.</p>
<p>Ce devis est valable 30 jours à compter de sa date d'émission. Pour l'accepter, il vous suffit de me retourner ce document signé.</p>
<p>N'hésitez pas à me contacter si vous avez des questions ou souhaitez apporter des modifications.</p>
<p>Cordialement,<br>${ctx.workspace_name}</p>`;

  return { subject, bodyPlain, bodyHtml };
}
