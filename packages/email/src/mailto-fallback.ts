/** Générateur URL mailto: RFC 6068. Pas de support attachment (limite protocole). */

export interface MailtoOptions {
  to: string;
  subject: string;
  body: string;
}

export function buildMailtoUrl(opts: MailtoOptions): string {
  const params = new URLSearchParams();
  params.set("subject", opts.subject);
  params.set("body", opts.body);
  const query = params.toString();
  const toEncoded = encodeURIComponent(opts.to);
  return `mailto:${toEncoded}?${query}`;
}
