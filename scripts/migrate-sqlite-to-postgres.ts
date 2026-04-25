#!/usr/bin/env bun
/**
 * Migration data SQLite local (mode 1 solo) → Postgres distant (mode 2 self-host).
 *
 * Stratégie : **one-shot, pas idempotent**. Le schéma cible doit être vide
 * (ou vous DROPpez avant). Pas de delta sync.
 *
 * Usage :
 *   bun run scripts/migrate-sqlite-to-postgres.ts \
 *     --sqlite ~/.fakt/db.sqlite \
 *     --pg postgres://fakt:secret@fakt.alphaluppi.fr:5432/fakt \
 *     --owner-email tom@alphaluppi.fr \
 *     [--dry-run]
 *
 * Pré-requis :
 *   - Migrations Drizzle PG appliquées (drizzle-kit push:pg ou via api-server boot).
 *   - Le user owner existe déjà (créé via seed-users.ts AVANT cette migration).
 *
 * Ordre topologique (FK dependencies) :
 *   workspaces → user_workspaces (lien owner) → clients → services →
 *   numbering_state → quotes → quote_items → invoices → invoice_items →
 *   signature_events → signed_documents → activity → settings → backups
 *
 * Conversion timestamps_ms (SQLite epoch millis) → Date ISO (Postgres timestamp tz).
 * UUIDs SQLite préservés tels quels (text → text, pas de re-attribution).
 */

import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { createPgDb, pgSchema } from "../packages/db/src/index.js";

interface Args {
  sqlite: string;
  pg: string;
  ownerEmail: string;
  dryRun: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const out: Partial<Args> = { dryRun: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--sqlite") out.sqlite = args[++i];
    else if (a === "--pg") out.pg = args[++i];
    else if (a === "--owner-email") out.ownerEmail = args[++i];
    else if (a === "--dry-run") out.dryRun = true;
  }
  if (!out.sqlite || !out.pg || !out.ownerEmail) {
    console.error("usage: --sqlite <path> --pg <url> --owner-email <email> [--dry-run]");
    process.exit(1);
  }
  return out as Args;
}

function toDate(ms: number | null | undefined): Date | null {
  if (ms === null || ms === undefined) return null;
  return new Date(ms);
}

async function main(): Promise<void> {
  const args = parseArgs();
  const sqlite = new Database(args.sqlite, { readonly: true });
  const pgDb = createPgDb(args.pg);

  console.log(`[migrate] sqlite=${args.sqlite}`);
  console.log(`[migrate] pg=${args.pg.replace(/:[^:@]+@/, ":***@")}`);
  console.log(`[migrate] dry-run=${args.dryRun}`);

  // ── 1. Lookup owner user_id (doit déjà exister, créé par seed-users.ts) ──
  const ownerRows = await pgDb
    .select()
    .from(pgSchema.users)
    .where(eq(pgSchema.users.email, args.ownerEmail.toLowerCase()))
    .limit(1);
  const ownerUserId = ownerRows[0]?.id;
  if (!ownerUserId) {
    die(`owner ${args.ownerEmail} introuvable — créez-le d'abord avec seed-users.ts`);
  }

  // ── 2. Workspaces ──
  const workspaces = sqlite
    .prepare(
      "SELECT id, name, legal_form, siret, address, email, iban, tva_mention, created_at FROM workspaces"
    )
    .all() as Array<{
    id: string;
    name: string;
    legal_form: string;
    siret: string;
    address: string;
    email: string;
    iban: string | null;
    tva_mention: string;
    created_at: number;
  }>;
  console.log(`[migrate] ${workspaces.length} workspaces`);
  if (!args.dryRun && workspaces.length > 0) {
    await pgDb
      .insert(pgSchema.workspaces)
      .values(
        workspaces.map((w) => ({
          id: w.id,
          name: w.name,
          legalForm: w.legal_form,
          siret: w.siret,
          address: w.address,
          email: w.email,
          iban: w.iban,
          tvaMention: w.tva_mention,
          createdAt: toDate(w.created_at) ?? new Date(),
        }))
      )
      .onConflictDoNothing();
  }

  // ── 3. Lien owner → workspace(s) (en plus de seed-users qui le crée déjà) ──
  for (const w of workspaces) {
    if (!args.dryRun) {
      await pgDb
        .insert(pgSchema.userWorkspaces)
        .values({ userId: ownerUserId, workspaceId: w.id, role: "owner" })
        .onConflictDoNothing();
    }
  }

  // ── 4. Clients ──
  const clients = sqlite.prepare("SELECT * FROM clients").all() as Array<Record<string, any>>;
  console.log(`[migrate] ${clients.length} clients`);
  if (!args.dryRun && clients.length > 0) {
    await pgDb.insert(pgSchema.clients).values(
      clients.map((c) => ({
        id: c.id,
        workspaceId: c.workspace_id,
        createdBy: ownerUserId,
        name: c.name,
        legalForm: c.legal_form,
        siret: c.siret,
        address: c.address,
        contactName: c.contact_name,
        email: c.email,
        sector: c.sector,
        firstCollaboration: toDate(c.first_collab),
        note: c.note,
        archivedAt: toDate(c.archived_at),
        createdAt: toDate(c.created_at) ?? new Date(),
      }))
    );
  }

  // ── 5. Services ──
  const services = sqlite.prepare("SELECT * FROM services").all() as Array<Record<string, any>>;
  console.log(`[migrate] ${services.length} services`);
  if (!args.dryRun && services.length > 0) {
    await pgDb.insert(pgSchema.services).values(
      services.map((s) => ({
        id: s.id,
        workspaceId: s.workspace_id,
        createdBy: ownerUserId,
        name: s.name,
        description: s.description,
        unit: s.unit,
        unitPriceCents: s.unit_price_cents,
        tags: s.tags,
        archivedAt: toDate(s.archived_at),
        createdAt: toDate(s.created_at) ?? new Date(),
      }))
    );
  }

  // ── 6. Numbering state ──
  const numbering = sqlite
    .prepare("SELECT * FROM numbering_state")
    .all() as Array<Record<string, any>>;
  console.log(`[migrate] ${numbering.length} numbering_state rows`);
  if (!args.dryRun && numbering.length > 0) {
    await pgDb.insert(pgSchema.numberingState).values(
      numbering.map((n) => ({
        workspaceId: n.workspace_id,
        year: n.year,
        type: n.type,
        lastSequence: n.last_sequence,
      }))
    );
  }

  // ── 7. Quotes + items ──
  const quotes = sqlite.prepare("SELECT * FROM quotes").all() as Array<Record<string, any>>;
  console.log(`[migrate] ${quotes.length} quotes`);
  if (!args.dryRun && quotes.length > 0) {
    await pgDb.insert(pgSchema.quotes).values(
      quotes.map((q) => ({
        id: q.id,
        workspaceId: q.workspace_id,
        createdBy: ownerUserId,
        clientId: q.client_id,
        number: q.number,
        year: q.year,
        sequence: q.sequence,
        title: q.title,
        status: q.status,
        totalHtCents: q.total_ht_cents,
        conditions: q.conditions,
        validityDate: toDate(q.validity_date),
        notes: q.notes,
        issuedAt: toDate(q.issued_at),
        signedAt: toDate(q.signed_at),
        archivedAt: toDate(q.archived_at),
        createdAt: toDate(q.created_at) ?? new Date(),
        updatedAt: toDate(q.updated_at) ?? new Date(),
      }))
    );
  }

  const quoteItems = sqlite.prepare("SELECT * FROM quote_items").all() as Array<Record<string, any>>;
  console.log(`[migrate] ${quoteItems.length} quote_items`);
  if (!args.dryRun && quoteItems.length > 0) {
    await pgDb.insert(pgSchema.quoteItems).values(
      quoteItems.map((q) => ({
        id: q.id,
        quoteId: q.quote_id,
        position: q.position,
        description: q.description,
        quantity: q.quantity_milli,
        unitPriceCents: q.unit_price_cents,
        unit: q.unit,
        lineTotalCents: q.line_total_cents,
        serviceId: q.service_id,
      }))
    );
  }

  // ── 8. Invoices + items ──
  const invoices = sqlite.prepare("SELECT * FROM invoices").all() as Array<Record<string, any>>;
  console.log(`[migrate] ${invoices.length} invoices`);
  if (!args.dryRun && invoices.length > 0) {
    await pgDb.insert(pgSchema.invoices).values(
      invoices.map((i) => ({
        id: i.id,
        workspaceId: i.workspace_id,
        createdBy: ownerUserId,
        clientId: i.client_id,
        quoteId: i.quote_id,
        number: i.number,
        year: i.year,
        sequence: i.sequence,
        kind: i.kind,
        depositPercent: i.deposit_percent,
        title: i.title,
        status: i.status,
        totalHtCents: i.total_ht_cents,
        dueDate: toDate(i.due_date),
        paidAt: toDate(i.paid_at),
        paymentMethod: i.payment_method,
        paymentNotes: i.payment_notes,
        legalMentions: i.legal_mentions,
        issuedAt: toDate(i.issued_at),
        archivedAt: toDate(i.archived_at),
        createdAt: toDate(i.created_at) ?? new Date(),
        updatedAt: toDate(i.updated_at) ?? new Date(),
      }))
    );
  }

  const invoiceItems = sqlite
    .prepare("SELECT * FROM invoice_items")
    .all() as Array<Record<string, any>>;
  console.log(`[migrate] ${invoiceItems.length} invoice_items`);
  if (!args.dryRun && invoiceItems.length > 0) {
    await pgDb.insert(pgSchema.invoiceItems).values(
      invoiceItems.map((i) => ({
        id: i.id,
        invoiceId: i.invoice_id,
        position: i.position,
        description: i.description,
        quantity: i.quantity_milli,
        unitPriceCents: i.unit_price_cents,
        unit: i.unit,
        lineTotalCents: i.line_total_cents,
        serviceId: i.service_id,
      }))
    );
  }

  // ── 9. Signature events ──
  const sigEvents = sqlite
    .prepare("SELECT * FROM signature_events")
    .all() as Array<Record<string, any>>;
  console.log(`[migrate] ${sigEvents.length} signature_events`);
  if (!args.dryRun && sigEvents.length > 0) {
    await pgDb.insert(pgSchema.signatureEvents).values(
      sigEvents.map((s) => ({
        id: s.id,
        documentType: s.document_type,
        documentId: s.document_id,
        signerName: s.signer_name,
        signerEmail: s.signer_email,
        signedByUserId: ownerUserId,
        ipAddress: s.ip_address,
        userAgent: s.user_agent,
        timestamp: toDate(s.timestamp) ?? new Date(),
        docHashBefore: s.doc_hash_before,
        docHashAfter: s.doc_hash_after,
        signaturePngBase64: s.signature_png_base64,
        previousEventHash: s.previous_event_hash,
        tsaResponse: s.tsa_response,
        tsaProvider: s.tsa_provider,
      }))
    );
  }

  // ── 10. Signed documents ──
  const signedDocs = sqlite
    .prepare("SELECT * FROM signed_documents")
    .all() as Array<Record<string, any>>;
  console.log(`[migrate] ${signedDocs.length} signed_documents`);
  if (!args.dryRun && signedDocs.length > 0) {
    await pgDb.insert(pgSchema.signedDocuments).values(
      signedDocs.map((d) => ({
        documentType: d.document_type,
        documentId: d.document_id,
        path: d.path,
        padesLevel: d.pades_level,
        tsaProvider: d.tsa_provider,
        signedAt: toDate(d.signed_at) ?? new Date(),
        signatureEventId: d.signature_event_id,
      }))
    );
  }

  // ── 11. Activity ──
  const activity = sqlite.prepare("SELECT * FROM activity").all() as Array<Record<string, any>>;
  console.log(`[migrate] ${activity.length} activity rows`);
  if (!args.dryRun && activity.length > 0) {
    await pgDb.insert(pgSchema.activity).values(
      activity.map((a) => ({
        id: a.id,
        workspaceId: a.workspace_id,
        actorUserId: ownerUserId,
        type: a.type,
        entityType: a.entity_type,
        entityId: a.entity_id,
        payload: a.payload,
        createdAt: toDate(a.created_at) ?? new Date(),
      }))
    );
  }

  // ── 12. Settings ──
  const settings = sqlite.prepare("SELECT * FROM settings").all() as Array<Record<string, any>>;
  console.log(`[migrate] ${settings.length} settings`);
  if (!args.dryRun && settings.length > 0) {
    await pgDb.insert(pgSchema.settings).values(
      settings.map((s) => ({
        workspaceId: s.workspace_id,
        key: s.key,
        value: s.value,
        updatedAt: toDate(s.updated_at) ?? new Date(),
      }))
    );
  }

  // ── 13. Backups ──
  const backups = sqlite.prepare("SELECT * FROM backups").all() as Array<Record<string, any>>;
  console.log(`[migrate] ${backups.length} backups`);
  if (!args.dryRun && backups.length > 0) {
    await pgDb.insert(pgSchema.backups).values(
      backups.map((b) => ({
        id: b.id,
        path: b.path,
        sizeBytes: b.size_bytes,
        createdAt: toDate(b.created_at) ?? new Date(),
      }))
    );
  }

  console.log("\n========================================");
  console.log(args.dryRun ? "DRY-RUN OK — aucune écriture" : "MIGRATION TERMINÉE");
  console.log("========================================");
  console.log("Étapes manuelles restantes :");
  console.log("  1. Copier les PDFs signés :");
  console.log("     scp -r ~/.fakt/signed/* user@vps:/var/lib/fakt/signed/");
  console.log("  2. Tester depuis l'app desktop : login + ouverture d'un devis existant.");
  console.log("========================================\n");

  sqlite.close();
  process.exit(0);
}

function die(reason: string): never {
  console.error(`[migrate] ${reason}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
