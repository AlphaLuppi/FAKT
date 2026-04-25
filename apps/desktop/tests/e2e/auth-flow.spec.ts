import { expect, test } from "@playwright/test";

declare const process: { env: Record<string, string | undefined> };

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
 *
 * Selectors : on utilise les testids stables `login-*` et `settings-backend-*`
 * pour qu'au dé-skip ces tests ne dépendent plus du wording français exact.
 */

const E2E_WITH_BACKEND = process.env.FAKT_E2E_BACKEND === "1";

test.describe("Auth flow E2E (mode 2 self-host)", () => {
  test.skip(!E2E_WITH_BACKEND, "Nécessite backend api-server + Postgres seedé");

  test("login → redirect dashboard → logout → redirect /login", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __FAKT_MODE__: number }).__FAKT_MODE__ = 2;
    });
    await page.goto("/login");

    await page.getByTestId("login-email").fill(process.env.FAKT_E2E_USER ?? "tom@alphaluppi.fr");
    await page.getByTestId("login-password").fill(process.env.FAKT_E2E_PASSWORD ?? "");
    await page.getByTestId("login-submit").click();

    await expect(page).toHaveURL("/", { timeout: 5_000 });

    // Logout via le tab Backend des settings — settings-backend-logout est
    // exposé en mode 2 self-host quand l'auth est active.
    await page.goto("/settings");
    await page.getByTestId("settings-backend-logout").click();
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
