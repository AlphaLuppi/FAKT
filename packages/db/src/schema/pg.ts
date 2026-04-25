import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Schéma Drizzle — dialecte Postgres (mode 2 self-host entreprise + mode 3 SaaS).
 *
 * Miroir fonctionnel de schema/index.ts (SQLite v0.1) avec types adaptés Postgres :
 *   - timestamp_ms (epoch millis) → timestamp(precision: 3, withTimezone: true)
 *   - integer cents → bigint (Postgres int4 OK pour cents mais int8 plus safe à long terme)
 *   - text id → text id (on conserve UUIDs string pour rétro-compat données SQLite migrées)
 *   - status enums → text + check constraint applicatif (Zod côté API)
 *
 * Tables additionnelles vs SQLite :
 *   - users, user_workspaces, sessions (multi-user MVP)
 *   - oauth_accounts (placeholder Google OAuth, non implémenté MVP)
 *
 * North star multi-workspace : toutes les tables métier conservent workspace_id FK.
 * La structure n:n user_workspaces permet d'évoluer vers holding+filiales sans migration.
 */

// ============================================================================
// AUTH — users, sessions, oauth (multi-user MVP)
// ============================================================================

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    fullName: text("full_name").notNull(),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { precision: 3, withTimezone: true })
      .notNull()
      .default(sql`now()`),
    lastLoginAt: timestamp("last_login_at", { precision: 3, withTimezone: true }),
    disabledAt: timestamp("disabled_at", { precision: 3, withTimezone: true }),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email)]
);

export const userWorkspaces = pgTable(
  "user_workspaces",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").notNull(),
    role: text("role", { enum: ["owner", "admin", "member"] })
      .notNull()
      .default("member"),
    joinedAt: timestamp("joined_at", { precision: 3, withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.workspaceId] }),
    index("user_workspaces_ws_idx").on(t.workspaceId),
  ]
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { precision: 3, withTimezone: true })
      .notNull()
      .default(sql`now()`),
    expiresAt: timestamp("expires_at", { precision: 3, withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { precision: 3, withTimezone: true }),
  },
  (t) => [
    index("sessions_user_idx").on(t.userId),
    index("sessions_token_idx").on(t.refreshTokenHash),
  ]
);

export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    provider: text("provider", { enum: ["google"] }).notNull(),
    providerUserId: text("provider_user_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { precision: 3, withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerUserId] }),
    index("oauth_user_idx").on(t.userId),
  ]
);

// ============================================================================
// METIER — workspaces + tables miroir de schema/index.ts
// ============================================================================

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  legalForm: text("legal_form").notNull(),
  siret: text("siret").notNull(),
  address: text("address").notNull(),
  email: text("email").notNull(),
  iban: text("iban"),
  tvaMention: text("tva_mention").notNull().default("TVA non applicable, art. 293 B du CGI"),
  createdAt: timestamp("created_at", { precision: 3, withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const settings = pgTable(
  "settings",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at", { precision: 3, withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.key] })]
);

export const clients = pgTable(
  "clients",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id),
    name: text("name").notNull(),
    legalForm: text("legal_form"),
    siret: text("siret"),
    address: text("address"),
    contactName: text("contact_name"),
    email: text("email"),
    sector: text("sector"),
    firstCollaboration: timestamp("first_collab", { precision: 3, withTimezone: true }),
    note: text("note"),
    archivedAt: timestamp("archived_at", { precision: 3, withTimezone: true }),
    createdAt: timestamp("created_at", { precision: 3, withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("clients_email_ws_uq").on(t.workspaceId, t.email),
    index("clients_name_idx").on(t.name),
    index("clients_ws_idx").on(t.workspaceId),
  ]
);

export const services = pgTable(
  "services",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id),
    name: text("name").notNull(),
    description: text("description"),
    unit: text("unit", {
      enum: ["forfait", "jour", "heure", "unité", "mois", "semaine"],
    }).notNull(),
    unitPriceCents: bigint("unit_price_cents", { mode: "number" }).notNull(),
    tags: text("tags"),
    archivedAt: timestamp("archived_at", { precision: 3, withTimezone: true }),
    createdAt: timestamp("created_at", { precision: 3, withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("services_ws_idx").on(t.workspaceId)]
);

export const numberingState = pgTable(
  "numbering_state",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    type: text("type", { enum: ["quote", "invoice"] }).notNull(),
    lastSequence: integer("last_sequence").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.year, t.type] })]
);

export const quotes = pgTable(
  "quotes",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id),
    number: text("number"),
    year: integer("year"),
    sequence: integer("sequence"),
    title: text("title").notNull(),
    status: text("status", {
      enum: ["draft", "sent", "viewed", "signed", "invoiced", "refused", "expired"],
    })
      .notNull()
      .default("draft"),
    totalHtCents: bigint("total_ht_cents", { mode: "number" }).notNull().default(0),
    conditions: text("conditions"),
    validityDate: timestamp("validity_date", { precision: 3, withTimezone: true }),
    notes: text("notes"),
    issuedAt: timestamp("issued_at", { precision: 3, withTimezone: true }),
    signedAt: timestamp("signed_at", { precision: 3, withTimezone: true }),
    archivedAt: timestamp("archived_at", { precision: 3, withTimezone: true }),
    createdAt: timestamp("created_at", { precision: 3, withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { precision: 3, withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("quotes_status_idx").on(t.status),
    index("quotes_client_idx").on(t.clientId),
    index("quotes_ws_idx").on(t.workspaceId),
    uniqueIndex("quotes_number_uq").on(t.workspaceId, t.year, t.sequence),
  ]
);

export const quoteItems = pgTable(
  "quote_items",
  {
    id: text("id").primaryKey(),
    quoteId: text("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    description: text("description").notNull(),
    quantity: bigint("quantity_milli", { mode: "number" }).notNull(),
    unitPriceCents: bigint("unit_price_cents", { mode: "number" }).notNull(),
    unit: text("unit").notNull(),
    lineTotalCents: bigint("line_total_cents", { mode: "number" }).notNull(),
    serviceId: text("service_id").references(() => services.id),
  },
  (t) => [index("quote_items_pos_idx").on(t.quoteId, t.position)]
);

export const invoices = pgTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id),
    quoteId: text("quote_id").references(() => quotes.id),
    number: text("number"),
    year: integer("year"),
    sequence: integer("sequence"),
    kind: text("kind", {
      enum: ["deposit", "balance", "total", "independent"],
    }).notNull(),
    depositPercent: integer("deposit_percent"),
    title: text("title").notNull(),
    status: text("status", {
      enum: ["draft", "sent", "paid", "overdue", "cancelled"],
    })
      .notNull()
      .default("draft"),
    totalHtCents: bigint("total_ht_cents", { mode: "number" }).notNull().default(0),
    dueDate: timestamp("due_date", { precision: 3, withTimezone: true }),
    paidAt: timestamp("paid_at", { precision: 3, withTimezone: true }),
    paymentMethod: text("payment_method"),
    paymentNotes: text("payment_notes"),
    legalMentions: text("legal_mentions").notNull(),
    issuedAt: timestamp("issued_at", { precision: 3, withTimezone: true }),
    archivedAt: timestamp("archived_at", { precision: 3, withTimezone: true }),
    createdAt: timestamp("created_at", { precision: 3, withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { precision: 3, withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("invoices_number_uq").on(t.workspaceId, t.year, t.sequence),
    index("invoices_status_idx").on(t.status),
    index("invoices_due_idx").on(t.dueDate),
    index("invoices_ws_idx").on(t.workspaceId),
  ]
);

export const invoiceItems = pgTable("invoice_items", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  description: text("description").notNull(),
  quantity: bigint("quantity_milli", { mode: "number" }).notNull(),
  unitPriceCents: bigint("unit_price_cents", { mode: "number" }).notNull(),
  unit: text("unit").notNull(),
  lineTotalCents: bigint("line_total_cents", { mode: "number" }).notNull(),
  serviceId: text("service_id").references(() => services.id),
});

export const signatureEvents = pgTable(
  "signature_events",
  {
    id: text("id").primaryKey(),
    documentType: text("document_type", { enum: ["quote", "invoice"] }).notNull(),
    documentId: text("document_id").notNull(),
    signerName: text("signer_name").notNull(),
    signerEmail: text("signer_email").notNull(),
    signedByUserId: uuid("signed_by_user_id").references(() => users.id),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    timestamp: timestamp("timestamp", { precision: 3, withTimezone: true }).notNull(),
    docHashBefore: text("doc_hash_before").notNull(),
    docHashAfter: text("doc_hash_after").notNull(),
    signaturePngBase64: text("signature_png_base64").notNull(),
    previousEventHash: text("previous_event_hash"),
    tsaResponse: text("tsa_response"),
    tsaProvider: text("tsa_provider"),
  },
  (t) => [
    index("sigevents_doc_idx").on(t.documentType, t.documentId),
    index("sigevents_prev_idx").on(t.previousEventHash),
  ]
);

export const activity = pgTable(
  "activity",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    type: text("type").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    payload: text("payload"),
    createdAt: timestamp("created_at", { precision: 3, withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("activity_created_idx").on(t.createdAt), index("activity_ws_idx").on(t.workspaceId)]
);

export const backups = pgTable("backups", {
  id: text("id").primaryKey(),
  path: text("path").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { precision: 3, withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const signedDocuments = pgTable(
  "signed_documents",
  {
    documentType: text("document_type", { enum: ["quote", "invoice"] }).notNull(),
    documentId: text("document_id").notNull(),
    path: text("path").notNull(),
    padesLevel: text("pades_level", { enum: ["B", "B-T"] }).notNull(),
    tsaProvider: text("tsa_provider"),
    signedAt: timestamp("signed_at", { precision: 3, withTimezone: true }).notNull(),
    signatureEventId: text("signature_event_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.documentType, t.documentId] }),
    index("signed_documents_event_idx").on(t.signatureEventId),
  ]
);
