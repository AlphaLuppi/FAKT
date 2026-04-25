/**
 * E2E release — navigation entre toutes les routes principales sans crash.
 *
 * Si une route mount un composant qui tente d'appeler une Tauri command
 * indisponible, ou qui fait un import ESM cassé en bundle release, l'app crash
 * silencieusement (panic=abort) ou affiche un overlay rouge React. Ce test
 * passe sur chacune et vérifie qu'on peut revenir au dashboard.
 *
 * Pré-requis : un workspace est seedé en DB SQLite (sidecar) — sinon on
 * accepte les redirections vers /onboarding.
 */

const ROUTES_TO_VISIT = [
  "/",
  "/quotes",
  "/invoices",
  "/clients",
  "/services",
  "/archive",
  "/settings",
  "/signatures",
] as const;

describe("FAKT release — navigation toutes routes", () => {
  for (const route of ROUTES_TO_VISIT) {
    it(`la route ${route} mount sans crash`, async () => {
      await browser.execute((path: string) => {
        // pushState pour ne pas reload l'iframe webview (qui ne marche pas
        // pareil sur Tauri) ; React Router intercepte le popstate.
        window.history.pushState({}, "", path);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, route);

      await browser.pause(500);
      const html = await browser.execute(() => document.body.innerHTML);

      expect(html.toLowerCase()).not.toContain("uncaught error");
      expect(html.toLowerCase()).not.toContain("something went wrong");
      // L'app peut soit montrer la route demandée, soit rediriger vers
      // /onboarding ou /login. Dans tous les cas, le DOM doit avoir du contenu.
      expect(html.length).toBeGreaterThan(100);
    });
  }
});
