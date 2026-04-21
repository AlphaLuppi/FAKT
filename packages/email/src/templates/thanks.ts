import type { TemplateContext, TemplateResult } from "./index.js";

export function thanksTemplate(ctx: TemplateContext): TemplateResult {
  const subject = `Confirmation de paiement — Facture ${ctx.doc_num}`;
  const bodyPlain = `Bonjour ${ctx.client_name},

Je vous confirme la bonne réception du paiement de la facture ${ctx.doc_num} d'un montant de ${ctx.amount_ttc_eur} TTC.

Je vous remercie de votre confiance et reste disponible pour toute future collaboration.

Cordialement,
${ctx.workspace_name}`;

  const bodyHtml = `<p>Bonjour ${ctx.client_name},</p>
<p>Je vous confirme la bonne réception du paiement de la facture <strong>${ctx.doc_num}</strong> d'un montant de <strong>${ctx.amount_ttc_eur} TTC</strong>.</p>
<p>Je vous remercie de votre confiance et reste disponible pour toute future collaboration.</p>
<p>Cordialement,<br>${ctx.workspace_name}</p>`;

  return { subject, bodyPlain, bodyHtml };
}
