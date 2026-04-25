#!/usr/bin/env bun
/**
 * Seed users — provisionne les comptes utilisateurs en mode 2 self-host.
 *
 * Usage :
 *   FAKT_SEED_USERS='[
 *     {"email":"tom@alphaluppi.fr","fullName":"Tom Andrieu","role":"owner"},
 *     {"email":"alice@alphaluppi.fr","fullName":"Alice","role":"member"}
 *   ]' \
 *   DATABASE_URL=postgres://fakt:secret@localhost:5432/fakt \
 *   FAKT_WORKSPACE_ID=<uuid-workspace-AlphaLuppi> \
 *   bun run scripts/seed-users.ts
 *
 * Pré-requis :
 *   - Le workspace AlphaLuppi doit déjà exister (créé via api workspace.post
 *     ou onboarding desktop avant migration data).
 *   - Les migrations Postgres doivent être appliquées (drizzle-kit push:pg).
 *
 * Sortie : pour chaque user créé, imprime stdout `email | password généré`.
 * À transmettre via Signal / 1Password / autre canal sécurisé aux 5 collègues.
 */

import { eq } from "drizzle-orm";
import { createPgDb, pgSchema } from "../packages/db/src/index.js";

interface SeedUser {
  email: string;
  fullName: string;
  role: "owner" | "admin" | "member";
}

interface CreatedUser {
  email: string;
  fullName: string;
  password: string;
  userId: string;
  role: string;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const workspaceId = process.env.FAKT_WORKSPACE_ID;
  const seedUsersRaw = process.env.FAKT_SEED_USERS;

  if (!databaseUrl) die("DATABASE_URL requis");
  if (!workspaceId) die("FAKT_WORKSPACE_ID requis");
  if (!seedUsersRaw) die("FAKT_SEED_USERS requis (JSON array)");

  let users: SeedUser[];
  try {
    users = JSON.parse(seedUsersRaw);
  } catch (err) {
    die(`FAKT_SEED_USERS JSON invalide: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!Array.isArray(users) || users.length === 0) {
    die("FAKT_SEED_USERS doit être un array non-vide");
  }
  for (const u of users) {
    if (!u.email || !u.fullName || !u.role) die(`user invalide: ${JSON.stringify(u)}`);
    if (!["owner", "admin", "member"].includes(u.role)) {
      die(`role invalide pour ${u.email}: ${u.role}`);
    }
  }

  // Import bcryptjs dynamiquement pour éviter d'imposer la dep en runtime
  // si non utilisé.
  const bcrypt = await import("bcryptjs").then((m) => m.default ?? m);

  const db = createPgDb(databaseUrl);

  // Vérifie que le workspace existe
  const ws = await db
    .select()
    .from(pgSchema.workspaces)
    .where(eq(pgSchema.workspaces.id, workspaceId))
    .limit(1);
  if (ws.length === 0) {
    die(
      `workspace ${workspaceId} introuvable — créez-le d'abord via l'API workspace ou la migration data`
    );
  }

  const created: CreatedUser[] = [];
  for (const u of users) {
    const email = u.email.toLowerCase();
    const existing = await db
      .select()
      .from(pgSchema.users)
      .where(eq(pgSchema.users.email, email))
      .limit(1);
    if (existing.length > 0) {
      console.warn(`[skip] ${email} existe déjà, lien workspace garanti idempotent`);
      const userId = existing[0]!.id;
      await db
        .insert(pgSchema.userWorkspaces)
        .values({ userId, workspaceId, role: u.role })
        .onConflictDoNothing();
      continue;
    }

    const password = generateRandomPassword();
    const passwordHash = await bcrypt.hash(password, 12);
    const inserted = await db
      .insert(pgSchema.users)
      .values({
        email,
        passwordHash,
        fullName: u.fullName,
      })
      .returning();
    const userId = inserted[0]!.id;
    await db.insert(pgSchema.userWorkspaces).values({
      userId,
      workspaceId,
      role: u.role,
    });
    created.push({
      email,
      fullName: u.fullName,
      password,
      userId,
      role: u.role,
    });
  }

  console.log("\n========================================");
  console.log("CREDENTIALS GÉNÉRÉS — TRANSMETTRE PAR CANAL SÉCURISÉ");
  console.log("========================================\n");
  for (const c of created) {
    console.log(`${c.email}  →  ${c.password}    (${c.fullName}, ${c.role})`);
  }
  console.log("\n========================================");
  console.log(`${created.length} user(s) créé(s) dans workspace ${workspaceId}`);
  console.log("========================================\n");

  process.exit(0);
}

function generateRandomPassword(): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) {
    out += charset[b % charset.length];
  }
  return out;
}

function die(reason: string): never {
  console.error(`[seed-users] ${reason}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
