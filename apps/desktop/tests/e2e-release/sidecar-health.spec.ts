/**
 * E2E release — santé du sidecar Bun bundlé.
 *
 * C'est typiquement ce qui casse en release et pas en dev : le binaire
 * `binaries/fakt-api-<triple>` est packagé à un autre path qu'en dev. Si la
 * détection de port (regex stdout `FAKT_API_READY:port=<N>`) échoue ou si
 * health check ne répond pas, l'app reste sur splash et toutes les pages
 * affichent un état d'erreur.
 *
 * On vérifie ici que :
 *   1. Le sidecar répond sur l'URL injectée par Rust
 *   2. /api/health renvoie ok=true
 *   3. /api/setup renvoie un state lisible (pas une 5xx)
 */

describe("FAKT release — sidecar Bun bundlé", () => {
  it("le sidecar répond /api/health en moins de 5s", async () => {
    const apiUrl = await browser.execute(
      () => (window as unknown as { __FAKT_API_URL__?: string }).__FAKT_API_URL__
    );
    expect(apiUrl).toBeTruthy();

    const result = await browser.executeAsync<
      { ok: boolean; status?: number; error?: string },
      [string]
    >((apiUrl: string, done: (r: { ok: boolean; status?: number; error?: string }) => void) => {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 5000);
      fetch(`${apiUrl}/api/health`, { signal: controller.signal })
        .then((r) => r.json().then((j) => ({ ok: j?.ok === true, status: r.status })))
        .catch((e) => ({ ok: false, error: String(e) }))
        .then((res) => {
          clearTimeout(t);
          done(res);
        });
    }, apiUrl as string);

    expect(result.ok).toBe(true);
  });

  it("le sidecar renvoie un state setup cohérent sur /api/setup", async () => {
    const apiUrl = await browser.execute(
      () => (window as unknown as { __FAKT_API_URL__?: string }).__FAKT_API_URL__
    );
    const token = await browser.execute(
      () => (window as unknown as { __FAKT_API_TOKEN__?: string }).__FAKT_API_TOKEN__
    );

    const result = await browser.executeAsync<{ status: number; body: unknown }, [string, string]>(
      (apiUrl: string, token: string, done: (r: { status: number; body: unknown }) => void) => {
        fetch(`${apiUrl}/api/setup`, {
          headers: token ? { "X-FAKT-Token": token } : {},
        })
          .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }))
          .then(done)
          .catch((e) => done({ status: -1, body: String(e) }));
      },
      apiUrl as string,
      (token as string) ?? ""
    );

    expect(result.status).toBe(200);
    expect(typeof result.body).toBe("object");
  });
});
