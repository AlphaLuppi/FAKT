import { sqliteTable, text, integer, unique, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/** Schéma Drizzle — SQLite dialect primaire (v0.1). PG commenté préparé v0.2. */

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  legalForm: text("legal_form").notNull(),
  siret: text("siret").notNull(),
  address: text("address").notNull(),
  email: text("email").notNull(),
  iban: text("iban"),
  tvaMention: text("tva_mention")
    .notNull()
    .default("TVA non applicable, art. 293 B du CGI"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const settings = sqliteTable(
  "settings",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    pk: unique().on(t.workspaceId, t.key),
  })
);

export const clients = sqliteTable(
  "clients",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    name: text("name").notNull(),
    legalForm: text("legal_form"),
    siret: text("siret"),
    address: text("address"),
    contactName: text("contact_name"),
    email: text("email"),
    sector: text("sector"),
    firstCollaboration: integer("first_collab", { mode: "timestamp_ms" }),
    note: text("note"),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    emailUniq: unique("clients_email_ws_uq").on(t.workspaceId, t.email),
    nameIdx: index("clients_name_idx").on(t.name),
  })
);

export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  name: text("name").notNull(),
  description: text("description"),
  unit: text("unit", {
    enum: ["forfait", "jour", "heure", "unité", "mois", "semaine"],
  }).notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  tags: text("tags"),
  archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const numberingState = sqliteTable(
  "numbering_state",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    year: integer("year").notNull(),
    type: text("type", { enum: ["quote", "invoice"] }).notNull(),
    lastSequence: integer("last_sequence").notNull().default(0),
  },
  (t) => ({
    pk: unique("numbering_pk").on(t.workspaceId, t.year, t.type),
  })
);

export const quotes = sqliteTable(
  "quotes",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
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
    totalHtCents: integer("total_ht_cents").notNull().default(0),
    conditions: text("conditions"),
    validityDate: integer("validity_date", { mode: "timestamp_ms" }),
    notes: text("notes"),
    issuedAt: integer("issued_at", { mode: "timestamp_ms" }),
    signedAt: integer("signed_at", { mode: "timestamp_ms" }),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    statusIdx: index("quotes_status_idx").on(t.status),
    clientIdx: index("quotes_client_idx").on(t.clientId),
    numberUniq: unique("quotes_number_uq").on(t.workspaceId, t.year, t.sequence),
  })
);

export const quoteItems = sqliteTable(
  "quote_items",
  {
    id: text("id").primaryKey(),
    quoteId: text("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    description: text("description").notNull(),
    quantity: integer("quantity_milli").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    unit: text("unit").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
    serviceId: text("service_id").references(() => services.id),
  },
  (t) => ({
    posIdx: index("quote_items_pos_idx").on(t.quoteId, t.position),
  })
);

export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
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
    totalHtCents: integer("total_ht_cents").notNull().default(0),
    dueDate: integer("due_date", { mode: "timestamp_ms" }),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
    paymentMethod: text("payment_method"),
    legalMentions: text("legal_mentions").notNull(),
    issuedAt: integer("issued_at", { mode: "timestamp_ms" }),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    numberUniq: unique("invoices_number_uq").on(t.workspaceId, t.year, t.sequence),
    statusIdx: index("invoices_status_idx").on(t.status),
    dueIdx: index("invoices_due_idx").on(t.dueDate),
  })
);

export const invoiceItems = sqliteTable("invoice_items", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  description: text("description").notNull(),
  quantity: integer("quantity_milli").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  unit: text("unit").notNull(),
  lineTotalCents: integer("line_total_cents").notNull(),
  serviceId: text("service_id").references(() => services.id),
});

export const signatureEvents = sqliteTable(
  "signature_events",
  {
    id: text("id").primaryKey(),
    documentType: text("document_type", { enum: ["quote", "invoice"] }).notNull(),
    documentId: text("document_id").notNull(),
    signerName: text("signer_name").notNull(),
    signerEmail: text("signer_email").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    timestamp: integer("timestamp", { mode: "timestamp_ms" }).notNull(),
    docHashBefore: text("doc_hash_before").notNull(),
    docHashAfter: text("doc_hash_after").notNull(),
    signaturePngBase64: text("signature_png_base64").notNull(),
    previousEventHash: text("previous_event_hash"),
    tsaResponse: text("tsa_response"),
    tsaProvider: text("tsa_provider"),
  },
  (t) => ({
    docIdx: index("sigevents_doc_idx").on(t.documentType, t.documentId),
    chainIdx: index("sigevents_prev_idx").on(t.previousEventHash),
  })
);

export const activity = sqliteTable(
  "activity",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    type: text("type").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    payload: text("payload"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => ({
    createdIdx: index("activity_created_idx").on(t.createdAt),
  })
);

export const backups = sqliteTable("backups", {
  id: text("id").primaryKey(),
  path: text("path").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});
