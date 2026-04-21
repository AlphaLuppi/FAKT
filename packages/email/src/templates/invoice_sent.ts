import type { TemplateContext, TemplateResult } from "./index.js";

export function invoiceSentTemplate(ctx: TemplateContext): TemplateResult {
  const dueLine = ctx.due_date_fr
    ? `La facture est payable avant le ${ctx.due_date_fr}.`
    : "La facture est payable selon les conditions mentionnées dans le document.";

  const subject = `Facture ${ctx.doc_num} — ${ctx.workspace_name}`;
  const bodyPlain = `Bonjour ${ctx.client_name},

Veuillez trouver ci-joint la facture ${ctx.doc_num} d'un montant de ${ctx.amount_ttc_eur} TTC.

${dueLine}

Le règlement peut s'effectuer par virement bancaire (coordonnées en pied de facture).

Cordialement,
${ctx.workspace_name}`;

  const bodyHtml = `<p>Bonjour ${ctx.client_name},</p>
<p>Veuillez trouver ci-joint la facture <strong>${ctx.doc_num}</strong> d'un montant de <strong>${ctx.amount_ttc_eur} TTC</strong>.</p>
<p>${dueLine}</p>
<p>Le règlement peut s'effectuer par virement bancaire (coordonnées en pied de facture).</p>
<p>Cordialement,<br>${ctx.workspace_name}</p>`;

  return { subject, bodyPlain, bodyHtml };
}
