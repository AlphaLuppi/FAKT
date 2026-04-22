/**
 * Queries numérotation séquentielle.
 *
 * STUB non-atomique — Track B v0.1
 * Implémentation via SELECT MAX + 1 en transaction Drizzle.
 *
 * ATTENTION : cette implémentation est NON-ATOMIQUE sur accès concurrents.
 * Elle est suffisante pour le mode solo-local mono-user (v0.1) où une seule
 * connexion SQLite est active à la fois.
 *
 * Migration path documentée dans packages/db/TODO.md :
 * Track D (Wave 2) fournira l'implémentation atomique via BEGIN IMMEDIATE
 * dans une Tauri command Rust dédiée (apps/desktop/src-tauri/src/db/numbering.rs).
 */

import { formatInvoiceNumber, formatQuoteNumber } from "@fakt/core";
import { and, eq, sql } from "drizzle-orm";
import type { DbInstance } from "../adapter.js";
import { numberingState } from "../schema/index.js";

/**
 * Type structurel minimal du driver SQLite brut (better-sqlite3 ou bun:sqlite).
 * Expose uniquement `transaction(fn).immediate()` requis pour BEGIN IMMEDIATE.
 */
export interface SqliteDriverLike {
  transaction<T>(fn: (...args: unknown[]) => T): {
    (...args: unknown[]): T;
    immediate: (...args: unknown[]) => T;
  };
}

export type DocType = "quote" | "invoice";

export interface NumberingResult {
  year: number;
  sequence: number;
  /** Numéro formaté : D2026-001 ou F2026-001 */
  formatted: string;
}

/**
 * Incrémente et retourne le prochain numéro de devis.
 *
 * @warning NON-ATOMIQUE — voir TODO.md pour migration Track D.
 */
export function nextQuoteNumber(db: DbInstance, workspaceId: string): NumberingResult {
  return nextNumber(db, workspaceId, "quote");
}

/**
 * Incrémente et retourne le prochain numéro de facture.
 *
 * @warning NON-ATOMIQUE — voir TODO.md pour migration Track D.
 */
export function nextInvoiceNumber(db: DbInstance, workspaceId: string): NumberingResult {
  return nextNumber(db, workspaceId, "invoice");
}

/**
 * Atomique : wrap nextNumber dans BEGIN IMMEDIATE SQLite.
 * Accepte l'instance SQLite brute (better-sqlite3 ou bun:sqlite — API compatible).
 * Utilisé côté api-server pour garantir CGI art. 289 (pas de trou, pas de double).
 */
export function nextNumberAtomic(
  sqlite: SqliteDriverLike,
  db: DbInstance,
  workspaceId: string,
  type: DocType
): NumberingResult {
  const txn = sqlite.transaction((): NumberingResult => nextNumber(db, workspaceId, type));
  return txn.immediate();
}

/**
 * Peek : retourne le prochain numéro prévu SANS l'incrémenter.
 * Utile pour l'affichage préalable dans l'UI (command preview_next_number).
 */
export function peekNextNumber(
  db: DbInstance,
  workspaceId: string,
  type: DocType
): NumberingResult {
  const year = new Date().getFullYear();
  const current = db
    .select({ lastSequence: numberingState.lastSequence })
    .from(numberingState)
    .where(
      and(
        eq(numberingState.workspaceId, workspaceId),
        eq(numberingState.year, year),
        eq(numberingState.type, type)
      )
    )
    .get();

  const nextSeq = (current?.lastSequence ?? 0) + 1;
  return buildResult(type, year, nextSeq);
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function nextNumber(db: DbInstance, workspaceId: string, type: DocType): NumberingResult {
  const year = new Date().getFullYear();

  // Upsert-and-increment : stratégie optimiste compatible Drizzle/SQLite.
  // Lecture puis écriture dans la même "transaction" synchrone better-sqlite3.
  // NON-ATOMIQUE sur accès concurrents — acceptable mode mono-user v0.1.
  const existing = db
    .select({ lastSequence: numberingState.lastSequence })
    .from(numberingState)
    .where(
      and(
        eq(numberingState.workspaceId, workspaceId),
        eq(numberingState.year, year),
        eq(numberingState.type, type)
      )
    )
    .get();

  let nextSeq: number;

  if (existing) {
    nextSeq = existing.lastSequence + 1;
    db.update(numberingState)
      .set({ lastSequence: nextSeq })
      .where(
        and(
          eq(numberingState.workspaceId, workspaceId),
          eq(numberingState.year, year),
          eq(numberingState.type, type)
        )
      )
      .run();
  } else {
    nextSeq = 1;
    db.insert(numberingState)
      .values({
        workspaceId,
        year,
        type,
        lastSequence: 1,
      })
      .run();
  }

  return buildResult(type, year, nextSeq);
}

function buildResult(type: DocType, year: number, sequence: number): NumberingResult {
  const formatted =
    type === "quote" ? formatQuoteNumber(year, sequence) : formatInvoiceNumber(year, sequence);
  return { year, sequence, formatted };
}
