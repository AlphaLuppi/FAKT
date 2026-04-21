import { fr } from "@fakt/shared";

export function formatRelative(ts: number, now = Date.now()): string {
  const diffMs = now - ts;
  if (diffMs < 5_000) return fr.audit.relativeJustNow;
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return fr.audit.relativeSeconds(s);
  const m = Math.floor(s / 60);
  if (m < 60) return fr.audit.relativeMinutes(m);
  const h = Math.floor(m / 60);
  if (h < 24) return fr.audit.relativeHours(h);
  const d = Math.floor(h / 24);
  return fr.audit.relativeDays(d);
}
