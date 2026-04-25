import { expect, test } from "@playwright/test";

/**
 * Tests E2E du flow d'authentification mode 2 self-host.
 *
 * **Statut : SKIPPÉS pour le MVP.** Ces tests nécessitent un backend api-server
 * qui tourne sur localhost:3001 + un user seedé en DB Postgres. Pour les
 * activer :
 *   1. docker compose -f deploy/docker-compose.yml up -d
 *   2. bun run scripts/seed-users.ts
 *   3. retirer les .skip ci-dessous + setter FAKT_E2E_BACKEND=1
 *
 * Le smoke des champs login (sans backend) est dans login-web.spec.ts.
 */

const E2E_WITH_BACKEND = process.env.FAKT_E2E_BACKEND === "1";

test.describe("Auth flow E2E (mode 2 self-host)", () => {
  test.skip(!E2E_WITH_BACKEND, "Nécessite backend api-server + Postgres seedé");

  test("login → redirect dashboard → logout → redirect /login", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __FAKT_MODE__: number }).__FAKT_MODE__ = 2;
    });
    await page.goto("/login");

    await page.getByLabel(/email/i).fill(process.env.FAKT_E2E_USER ?? "tom@alphaluppi.fr");
    await page.getByLabel(/mot de passe/i).fill(process.env.FAKT_E2E_PASSWORD ?? "");
    await page.getByRole("button", { name: /(connexion|se connecter)/i }).click();

    await expect(page).toHaveURL("/", { timeout: 5_000 });

    // Logout via menu settings (à adapter selon le composant final)
    await page.goto("/settings");
    await page.getByRole("button", { name: /se déconnecter|logout/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("401 au refresh → redirect automatique /login", async ({ page: _page }) => {
    // Simule un cookie expiré : token stale envoyé, server répond 401.
    // L'ApiClient doit dispatch fakt:auth-expired et useAuth doit redirect.
    test.fail(); // À implémenter quand le backend test seed est dispo
  });

  test("rate limit : 5 mauvais passwords → blocage 15min", async ({ page: _page }) => {
    test.fail(); // Rate limit pas encore implémenté côté serveur
  });
});
