/**
 * Helpers pour les tests Vitest de packages/db.
 * Crée une DB SQLite :memory: avec le schéma complet + triggers.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "../schema/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TRIGGERS_SQL = readFileSync(join(__dirname, "../migrations/0001_triggers.sql"), "utf-8");

/**
 * DDL des tables — reflète schema/index.ts.
 * Maintenu manuellement pour les tests in-memory (Drizzle Kit ne génère pas
 * de migration initiale dans ce setup).
 */
const SCHEMA_DDL = [
  `CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    legal_form TEXT NOT NULL,
    siret TEXT NOT NULL,
    address TEXT NOT NULL,
    email TEXT NOT NULL,
    iban TEXT,
    tva_mention TEXT NOT NULL DEFAULT 'TVA non applicable, art. 293 B du CGI',
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(workspace_id, key)
  )`,
  `CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    name TEXT NOT NULL,
    legal_form TEXT,
    siret TEXT,
    address TEXT,
    contact_name TEXT,
    email TEXT,
    sector TEXT,
    first_collab INTEGER,
    note TEXT,
    archived_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    UNIQUE(workspace_id, email)
  )`,
  "CREATE INDEX IF NOT EXISTS clients_name_idx ON clients(name)",
  `CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    name TEXT NOT NULL,
    description TEXT,
    unit TEXT NOT NULL,
    unit_price_cents INTEGER NOT NULL,
    tags TEXT,
    archived_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE TABLE IF NOT EXISTS numbering_state (
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    year INTEGER NOT NULL,
    type TEXT NOT NULL,
    last_sequence INTEGER NOT NULL DEFAULT 0,
    UNIQUE(workspace_id, year, type)
  )`,
  `CREATE TABLE IF NOT EXISTS quotes (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    client_id TEXT NOT NULL REFERENCES clients(id),
    number TEXT,
    year INTEGER,
    sequence INTEGER,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    total_ht_cents INTEGER NOT NULL DEFAULT 0,
    conditions TEXT,
    validity_date INTEGER,
    notes TEXT,
    issued_at INTEGER,
    signed_at INTEGER,
    archived_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    UNIQUE(workspace_id, year, sequence)
  )`,
  "CREATE INDEX IF NOT EXISTS quotes_status_idx ON quotes(status)",
  "CREATE INDEX IF NOT EXISTS quotes_client_idx ON quotes(client_id)",
  `CREATE TABLE IF NOT EXISTS quote_items (
    id TEXT PRIMARY KEY,
    quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity_milli INTEGER NOT NULL,
    unit_price_cents INTEGER NOT NULL,
    unit TEXT NOT NULL,
    line_total_cents INTEGER NOT NULL,
    service_id TEXT REFERENCES services(id)
  )`,
  "CREATE INDEX IF NOT EXISTS quote_items_pos_idx ON quote_items(quote_id, position)",
  `CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    client_id TEXT NOT NULL REFERENCES clients(id),
    quote_id TEXT REFERENCES quotes(id),
    number TEXT,
    year INTEGER,
    sequence INTEGER,
    kind TEXT NOT NULL,
    deposit_percent INTEGER,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    total_ht_cents INTEGER NOT NULL DEFAULT 0,
    due_date INTEGER,
    paid_at INTEGER,
    payment_method TEXT,
    payment_notes TEXT,
    legal_mentions TEXT NOT NULL,
    issued_at INTEGER,
    archived_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    UNIQUE(workspace_id, year, sequence)
  )`,
  "CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices(status)",
  "CREATE INDEX IF NOT EXISTS invoices_due_idx ON invoices(due_date)",
  `CREATE TABLE IF NOT EXISTS invoice_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity_milli INTEGER NOT NULL,
    unit_price_cents INTEGER NOT NULL,
    unit TEXT NOT NULL,
    line_total_cents INTEGER NOT NULL,
    service_id TEXT REFERENCES services(id)
  )`,
  `CREATE TABLE IF NOT EXISTS signature_events (
    id TEXT PRIMARY KEY,
    document_type TEXT NOT NULL,
    document_id TEXT NOT NULL,
    signer_name TEXT NOT NULL,
    signer_email TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    timestamp INTEGER NOT NULL,
    doc_hash_before TEXT NOT NULL,
    doc_hash_after TEXT NOT NULL,
    signature_png_base64 TEXT NOT NULL,
    previous_event_hash TEXT,
    tsa_response TEXT,
    tsa_provider TEXT
  )`,
  "CREATE INDEX IF NOT EXISTS sigevents_doc_idx ON signature_events(document_type, document_id)",
  "CREATE INDEX IF NOT EXISTS sigevents_prev_idx ON signature_events(previous_event_hash)",
  `CREATE TABLE IF NOT EXISTS activity (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    type TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    payload TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  "CREATE INDEX IF NOT EXISTS activity_created_idx ON activity(created_at)",
  `CREATE TABLE IF NOT EXISTS backups (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE TABLE IF NOT EXISTS signed_documents (
    document_type TEXT NOT NULL CHECK (document_type IN ('quote', 'invoice')),
    document_id TEXT NOT NULL,
    path TEXT NOT NULL,
    pades_level TEXT NOT NULL CHECK (pades_level IN ('B', 'B-T')),
    tsa_provider TEXT,
    signed_at INTEGER NOT NULL,
    signature_event_id TEXT NOT NULL,
    PRIMARY KEY (document_type, document_id)
  )`,
  "CREATE INDEX IF NOT EXISTS signed_documents_event_idx ON signed_documents(signature_event_id)",
];

export type TestDb = BetterSQLite3Database<typeof schema>;

/** Crée une DB SQLite :memory: avec schema + triggers. */
export function createTestDb(): { db: TestDb; sqlite: Database.Database } {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  for (const stmt of SCHEMA_DDL) {
    sqlite.prepare(stmt).run();
  }
  // Triggers append-only signature_events + contraintes factures (0001_triggers.sql)
  // better-sqlite3 supporte .exec() pour les blocs multi-statements (BEGIN...END)
  sqlite.exec(TRIGGERS_SQL);
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

// ─── UUIDs stables pour les fixtures ─────────────────────────────────────────

export const WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";
export const CLIENT_ID_1 = "00000000-0000-0000-0000-000000000010";
export const CLIENT_ID_2 = "00000000-0000-0000-0000-000000000011";
export const SERVICE_ID_1 = "00000000-0000-0000-0000-000000000020";

/** Insère un workspace de test. */
export function seedWorkspace(db: TestDb): void {
  db.insert(schema.workspaces)
    .values({
      id: WORKSPACE_ID,
      name: "Tom Andrieu Test",
      legalForm: "Micro-entreprise",
      siret: "73282932000074",
      address: "1 rue de la Paix, 84000 Avignon",
      email: "contact@test.fr",
      iban: null,
      tvaMention: "TVA non applicable, art. 293 B du CGI",
      createdAt: new Date(Date.now()),
    })
    .run();
}

/** Insère un client de test. */
export function seedClient(db: TestDb, overrides: { id?: string; email?: string } = {}): void {
  db.insert(schema.clients)
    .values({
      id: overrides.id ?? CLIENT_ID_1,
      workspaceId: WORKSPACE_ID,
      name: "Client Test",
      email: overrides.email ?? "client@test.fr",
      archivedAt: null,
      createdAt: new Date(Date.now()),
    })
    .run();
}
