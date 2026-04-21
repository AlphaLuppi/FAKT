import type { TemplateContext, TemplateResult } from "./index.js";

export function reminderTemplate(ctx: TemplateContext): TemplateResult {
  const dueLine = ctx.due_date_fr
    ? `dont l'échéance était fixée au ${ctx.due_date_fr}`
    : "dont l'échéance est dépassée";

  const subject = `Rappel de paiement — Facture ${ctx.doc_num}`;
  const bodyPlain = `Bonjour ${ctx.client_name},

Sauf erreur de notre part, la facture ${ctx.doc_num} d'un montant de ${ctx.amount_ttc_eur} TTC, ${dueLine}, n'a pas encore été réglée.

Pourriez-vous procéder au paiement dans les meilleurs délais ou me faire part d'une éventuelle difficulté ?

Conformément à nos conditions, des pénalités de retard peuvent s'appliquer au taux légal en vigueur.

Cordialement,
${ctx.workspace_name}`;

  const bodyHtml = `<p>Bonjour ${ctx.client_name},</p>
<p>Sauf erreur de notre part, la facture <strong>${ctx.doc_num}</strong> d'un montant de <strong>${ctx.amount_ttc_eur} TTC</strong>, ${dueLine}, n'a pas encore été réglée.</p>
<p>Pourriez-vous procéder au paiement dans les meilleurs délais ou me faire part d'une éventuelle difficulté ?</p>
<p>Conformément à nos conditions, des pénalités de retard peuvent s'appliquer au taux légal en vigueur.</p>
<p>Cordialement,<br>${ctx.workspace_name}</p>`;

  return { subject, bodyPlain, bodyHtml };
}
