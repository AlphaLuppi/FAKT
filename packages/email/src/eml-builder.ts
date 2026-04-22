/**
 * Générateur .eml RFC 5322 + MIME multipart/mixed avec attachments PDF base64.
 * Encodage MIME word UTF-8 pour les en-têtes non-ASCII (subject, from avec nom).
 */

export interface EmlAttachment {
  filename: string;
  contentType: string;
  contentBase64: string;
}

export interface EmlOptions {
  from: string;
  to: string;
  subject: string;
  bodyPlain: string;
  bodyHtml?: string | undefined;
  attachments?: EmlAttachment[] | undefined;
  /** Seed optionnel pour boundary déterministe (tests). */
  boundarySeed?: string | undefined;
}

/** Encode une chaîne en MIME word UTF-8 Base64 si elle contient des chars non-ASCII. */
function mimeWordEncode(value: string): string {
  const hasNonAscii = /[^\x00-\x7F]/.test(value);
  if (!hasNonAscii) return value;
  const b64 = btoa(unescape(encodeURIComponent(value)));
  return `=?utf-8?B?${b64}?=`;
}

/** Wrap base64 sur 76 chars/ligne (RFC 2045). */
function wrapBase64(b64: string): string {
  const chunks: string[] = [];
  for (let i = 0; i < b64.length; i += 76) {
    chunks.push(b64.slice(i, i + 76));
  }
  return chunks.join("\r\n");
}

/** Formate une date au format RFC 2822. */
function rfc2822Date(date: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const day = days[date.getUTCDay()];
  const mon = months[date.getUTCMonth()];
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${day}, ${dd} ${mon} ${yyyy} ${hh}:${mm}:${ss} +0000`;
}

function generateBoundary(seed?: string): string {
  if (seed) {
    const seedHex = Array.from(seed)
      .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 24)
      .padEnd(24, "0");
    return `fakt_${seedHex}`;
  }
  const random = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `fakt_${Date.now().toString(16)}_${random}`;
}

export function buildEml(opts: EmlOptions): string {
  const boundary = generateBoundary(opts.boundarySeed);
  const lines: string[] = [];

  lines.push(`From: ${mimeWordEncode(opts.from)}`);
  lines.push(`To: ${mimeWordEncode(opts.to)}`);
  lines.push(`Subject: ${mimeWordEncode(opts.subject)}`);
  lines.push(`Date: ${rfc2822Date(new Date())}`);
  lines.push("MIME-Version: 1.0");
  lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  lines.push("");

  lines.push(`--${boundary}`);
  lines.push("Content-Type: text/plain; charset=utf-8");
  lines.push("Content-Transfer-Encoding: 7bit");
  lines.push("");
  lines.push(opts.bodyPlain);
  lines.push("");

  if (opts.bodyHtml) {
    lines.push(`--${boundary}`);
    lines.push("Content-Type: text/html; charset=utf-8");
    lines.push("Content-Transfer-Encoding: 7bit");
    lines.push("");
    lines.push(opts.bodyHtml);
    lines.push("");
  }

  for (const att of opts.attachments ?? []) {
    const filenameEncoded = mimeWordEncode(att.filename);
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: ${att.contentType}; name="${filenameEncoded}"`);
    lines.push("Content-Transfer-Encoding: base64");
    lines.push(`Content-Disposition: attachment; filename="${filenameEncoded}"`);
    lines.push("");
    lines.push(wrapBase64(att.contentBase64));
    lines.push("");
  }

  lines.push(`--${boundary}--`);
  lines.push("");

  return lines.join("\r\n");
}
