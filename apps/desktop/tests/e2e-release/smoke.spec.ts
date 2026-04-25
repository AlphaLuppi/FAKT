/**
 * Smoke E2E **release mode** — vérifie que le binaire FAKT packagé démarre
 * correctement et n'explose pas au boot.
 *
 * C'est ce test qui attrape les bugs release-only qu'on ne voit pas en
 * `bun run dev` :
 *   - chemins relatifs vers le sidecar (binaries/fakt-api-<triple>) cassés
 *     parce que packagé différemment en release
 *   - panic=abort silencieux (Rust release profile) qui crash sans stack trace
 *   - LTO + strip Windows qui crashe 0xc0000409 sur certaines combos
 *   - CSP qui block les timestamp servers en prod
 *   - injection de window.__FAKT_API_URL__ qui race avec le mount React
 *
 * Lancement : `bun run test:e2e:release` (après `bun --cwd apps/desktop tauri:build`).
 */

describe("FAKT release binary — smoke", () => {
  it("la fenêtre principale est ouverte avec un titre attendu", async () => {
    const title = await browser.getTitle();
    expect(title.toLowerCase()).toContain("fakt");
  });

  it("le DOM React est monté (au moins une heading visible)", async () => {
    const headings = await browser.$$("h1, h2, h3");
    expect(headings.length).toBeGreaterThan(0);
  });

  it("aucune erreur fatale dans la console webview", async () => {
    // browser.getLogs n'est pas dispo sur tauri-driver pour Linux WebKit.
    // À la place on vérifie que body.innerText ne contient pas un crash overlay.
    const bodyText = await browser.execute(() => document.body.innerText);
    expect(bodyText.toLowerCase()).not.toContain("panic");
    expect(bodyText.toLowerCase()).not.toContain("uncaught error");
    expect(bodyText.toLowerCase()).not.toContain("failed to start");
  });

  it("window.__FAKT_API_URL__ est injecté par Rust avant le mount React", async () => {
    const apiUrl = await browser.execute(
      () => (window as unknown as { __FAKT_API_URL__?: string }).__FAKT_API_URL__
    );
    expect(apiUrl).toBeTruthy();
    expect(apiUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });

  it("window.__FAKT_MODE__ est égal à 1 (sidecar local) par défaut", async () => {
    const mode = await browser.execute(
      () => (window as unknown as { __FAKT_MODE__?: number }).__FAKT_MODE__
    );
    expect(mode).toBe(1);
  });
});
