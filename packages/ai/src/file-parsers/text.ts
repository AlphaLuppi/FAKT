/**
 * Parsers natifs (sans dépendance externe) pour les formats textuels simples :
 * - .txt, .md, .markdown -> texte brut (décodé UTF-8 avec fallback latin-1).
 * - .eml -> extraction Subject / From / body (première partie text/plain si multipart).
 */

/**
 * Lit un File et décode son contenu en UTF-8.
 * Fallback silencieux sur windows-1252 si le décodage UTF-8 échoue massivement
 * (heuristique : taux anormal de U+FFFD).
 */
export async function readFileAsText(file: File): Promise<string> {
  const buf = await readFileAsArrayBuffer(file);
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  const replacementCount = (utf8.match(/\uFFFD/g) ?? []).length;
  if (replacementCount > 5 && replacementCount / Math.max(1, utf8.length) > 0.02) {
    try {
      return new TextDecoder("windows-1252", { fatal: false }).decode(buf);
    } catch {
      return utf8;
    }
  }
  return utf8;
}

/**
 * Lit un File en ArrayBuffer de manière compatible jsdom + browsers modernes.
 * jsdom (v25) n'expose pas toujours File.arrayBuffer() — fallback via FileReader.
 */
export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  // Utiliser la méthode native si disponible (Chrome / Firefox / Edge récents).
  if (typeof file.arrayBuffer === "function") {
    return file.arrayBuffer();
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (): void => {
      const r = reader.result;
      if (r instanceof ArrayBuffer) {
        resolve(r);
      } else {
        reject(new Error("FileReader returned unexpected result type"));
      }
    };
    reader.onerror = (): void => reject(reader.error ?? new Error("FileReader error"));
    reader.readAsArrayBuffer(file);
  });
}

/** Simple wrapper : .txt/.md/.markdown -> texte brut. */
export async function parseTextFile(file: File): Promise<string> {
  return readFileAsText(file);
}

// ----- Email (.eml) ---------------------------------------------------------

/**
 * Parser minimal .eml : extrait Subject, From, puis le body.
 * - Détecte multipart via Content-Type: multipart/...; boundary=...
 * - Si multipart, prend la première partie text/plain (ou text/html à défaut).
 * - Sinon, utilise tout ce qui suit la première ligne vide comme body.
 * - Ignore volontairement les encodages quoted-printable / base64 (best-effort).
 */
export function parseEmlText(raw: string): string {
  const normalized = raw.replace(/\r\n/g, "\n");
  const blankIdx = normalized.indexOf("\n\n");
  const headerBlock = blankIdx >= 0 ? normalized.slice(0, blankIdx) : normalized;
  const bodyRaw = blankIdx >= 0 ? normalized.slice(blankIdx + 2) : "";

  const subject = matchHeader(headerBlock, "Subject");
  const from = matchHeader(headerBlock, "From");
  const contentType = matchHeader(headerBlock, "Content-Type") ?? "";

  let body = bodyRaw;

  const boundaryMatch = /boundary\s*=\s*"?([^";\n]+)"?/i.exec(contentType);
  const boundaryValue = boundaryMatch?.[1];
  if (boundaryValue) {
    body = extractFirstTextPart(bodyRaw, boundaryValue.trim());
  }

  const pieces: string[] = [];
  if (subject) pieces.push(`Sujet : ${subject}`);
  if (from) pieces.push(`De : ${from}`);
  if (pieces.length > 0) pieces.push("");
  pieces.push(body.trim());
  return pieces.join("\n");
}

function matchHeader(headerBlock: string, name: string): string | null {
  const re = new RegExp(`^${escapeRe(name)}\\s*:\\s*(.*(?:\\n[ \\t].*)*)`, "im");
  const m = re.exec(headerBlock);
  if (!m || !m[1]) return null;
  return m[1].replace(/\n[ \t]+/g, " ").trim();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractFirstTextPart(bodyRaw: string, boundary: string): string {
  const splitRe = new RegExp(`--${escapeRe(boundary)}(?:--)?\\n`, "g");
  const parts = bodyRaw
    .split(splitRe)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  let htmlFallback: string | null = null;
  for (const part of parts) {
    const partBlank = part.indexOf("\n\n");
    if (partBlank < 0) continue;
    const partHeaders = part.slice(0, partBlank);
    const partBody = part.slice(partBlank + 2);
    if (/Content-Type\s*:\s*text\/plain/i.test(partHeaders)) {
      return partBody;
    }
    if (htmlFallback === null && /Content-Type\s*:\s*text\/html/i.test(partHeaders)) {
      htmlFallback = stripHtml(partBody);
    }
  }
  return htmlFallback ?? bodyRaw;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function parseEmlFile(file: File): Promise<string> {
  const raw = await readFileAsText(file);
  return parseEmlText(raw);
}
