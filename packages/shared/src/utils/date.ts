import type { TimestampMs } from "../types/domain.js";

const FR_DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const FR_DATE_LONG_FMT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Formate un timestamp en date FR courte (ex: 21/04/2026). */
export function formatFrDate(ts: TimestampMs): string {
  return FR_DATE_FMT.format(new Date(ts));
}

/** Formate un timestamp en date FR longue (ex: 21 avril 2026). */
export function formatFrDateLong(ts: TimestampMs): string {
  return FR_DATE_LONG_FMT.format(new Date(ts));
}

/** Retourne le timestamp MS du début du jour (minuit UTC+local) pour une date donnée. */
export function startOfDay(ts: TimestampMs): TimestampMs {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Ajoute N jours à un timestamp. */
export function addDays(ts: TimestampMs, days: number): TimestampMs {
  return ts + days * 24 * 60 * 60 * 1000;
}

/** Retourne le timestamp de la date d'aujourd'hui à minuit local. */
export function today(): TimestampMs {
  return startOfDay(Date.now());
}

/** Vérifie si un timestamp est dans le passé (par rapport à maintenant). */
export function isPast(ts: TimestampMs): boolean {
  return ts < Date.now();
}

/**
 * Calcule la date d'échéance standard (30 jours après l'émission).
 * Configurable via le paramètre days.
 */
export function computeDueDate(issuedAt: TimestampMs, days = 30): TimestampMs {
  return addDays(issuedAt, days);
}

/**
 * Calcule la date limite de validité d'un devis.
 * Par défaut 30 jours.
 */
export function computeValidityDate(issuedAt: TimestampMs, days = 30): TimestampMs {
  return addDays(issuedAt, days);
}

/** Retourne le nombre de jours restants avant un timestamp (négatif si passé). */
export function daysUntil(ts: TimestampMs): number {
  return Math.ceil((ts - Date.now()) / (24 * 60 * 60 * 1000));
}
