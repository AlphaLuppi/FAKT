import bcrypt from "bcryptjs";

/**
 * Password hashing pour FAKT.
 *
 * Choix retenu : **bcrypt cost=12** (pure JS via bcryptjs, pas de deps natives).
 * OWASP 2024 :
 *   - argon2id est la recommandation #1 (plus résistant GPU, mais natives requises)
 *   - bcrypt avec cost ≥ 10 est l'alternative acceptable #2
 *   - On choisit bcryptjs cost=12 pour rester portable Node + Bun + Vitest sans
 *     compilation native, et parce que pour 5 users internes avec login peu
 *     fréquent, la différence argon2/bcrypt est négligeable.
 *
 * Migration argon2id possible v0.3 SaaS si besoin de scalabilité (recompiler avec @node-rs/argon2).
 */

const COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < 8) {
    throw new Error("password must be at least 8 chars");
  }
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!plain || !hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/** Génère un password aléatoire 16 chars (URL-safe). Utilisé par seed-users.ts. */
export function generateRandomPassword(): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) {
    out += charset[b % charset.length];
  }
  return out;
}
