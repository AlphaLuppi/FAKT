# Google OAuth — Stub Documentation (non implémenté MVP)

**Audience :** Dev contributeur, futur intégrateur SaaS.
**Statut :** Préparation v0.3+. **PAS implémenté en MVP self-host AlphaLuppi.**
**Dernière mise à jour :** 2026-04-25

---

## Pourquoi un stub ?

Tom (mainteneur) a explicitement demandé que Google OAuth soit **documenté et préparé** dès le MVP self-host pour pouvoir l'activer plus tard sans rework architectural. La structure DB (`oauth_accounts` table) est déjà posée dans le schéma Postgres `packages/db/src/schema/pg.ts` — il ne reste que les endpoints + UI.

## Plan d'implémentation

### 1. Provisionner OAuth client GCP

1. Aller sur https://console.cloud.google.com/apis/credentials
2. Créer un projet "FAKT (AlphaLuppi)"
3. Activer l'API Google Identity / OAuth 2.0
4. Créer des credentials → "OAuth client ID" → Web application
5. **Authorized redirect URIs** :
   - `https://fakt.alphaluppi.fr/api/auth/google/callback` (prod)
   - `http://localhost:3001/api/auth/google/callback` (dev)
6. Récupérer `Client ID` + `Client Secret`

### 2. Ajouter les env vars

Dans `.env.local` (et secrets Dokploy en prod) :

```bash
GOOGLE_OAUTH_CLIENT_ID=<le client id>
GOOGLE_OAUTH_CLIENT_SECRET=<le client secret>
GOOGLE_OAUTH_REDIRECT_URI=https://fakt.alphaluppi.fr/api/auth/google/callback
```

Étendre `packages/api-server/src/config.ts` avec ces 3 env vars (optional).

### 3. Installer la lib

```bash
cd packages/api-server
bun add arctic
```

`arctic` est une lib OAuth2 minimaliste TypeScript (~5KB), maintenue par les auteurs de Lucia Auth. Plus simple que `passport`/`@auth/core`, plus typée que `simple-oauth2`.

### 4. Créer les endpoints

**Fichier à créer** : `packages/api-server/src/routes/oauth-google.ts`

```ts
import { Google, generateState, generateCodeVerifier } from "arctic";

const google = new Google(
  process.env.GOOGLE_OAUTH_CLIENT_ID!,
  process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
  process.env.GOOGLE_OAUTH_REDIRECT_URI!
);

export const googleOauthRoutes = new Hono();

// GET /api/auth/google/start
googleOauthRoutes.get("/start", async (c) => {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = await google.createAuthorizationURL(state, codeVerifier, {
    scopes: ["openid", "email", "profile"],
  });
  // Stocker state + verifier dans cookie httpOnly courte durée (10min).
  c.header("Set-Cookie", `oauth_state=${state}; HttpOnly; Secure; Path=/; Max-Age=600`, { append: true });
  c.header("Set-Cookie", `oauth_verifier=${codeVerifier}; HttpOnly; Secure; Path=/; Max-Age=600`, { append: true });
  return c.redirect(url.toString());
});

// GET /api/auth/google/callback
googleOauthRoutes.get("/callback", async (c) => {
  // 1. Vérifier state CSRF (cookie vs query param).
  // 2. Échanger le code contre tokens via google.validateAuthorizationCode().
  // 3. Fetch userinfo Google (id, email, name, picture).
  // 4. Lookup oauth_accounts (provider="google", provider_user_id=<sub>) :
  //    - Si match → user trouvé, login OK.
  //    - Sinon → lookup users.email = <email Google> :
  //        - Si match → INSERT oauth_accounts pour lier (auto-link first time).
  //        - Sinon → 403 "compte non provisionné — contacter admin".
  //          (ICP MVP fermé : pas d'auto-signup, l'admin AlphaLuppi crée les users.)
  // 5. Générer access + refresh tokens, set cookie, redirect /.
});
```

### 5. UI Login

Dans `apps/desktop/src/routes/auth/Login.tsx`, ajouter un bouton "Continuer avec Google" sous le form email/password. Brutal Invoice : bouton secondary blanc avec bordure 2px noir, logo Google noir.

### 6. Tests

- `packages/api-server/tests/oauth-google.test.ts` : mock Google API (msw ou nock), vérifie state CSRF, callback success, callback failure (no provisioned user).

## Sécurité

- **State CSRF** : obligatoire. Cookie state vs query param, comparaison string strict.
- **PKCE** : `generateCodeVerifier` + `code_challenge=S256` (Arctic le fait par défaut).
- **No auto-signup** : MVP fermé AlphaLuppi → l'admin crée les comptes via `scripts/seed-users.ts`. Si Google email ne match pas, rejeter (pas de création silencieuse de compte).
- **prompt=none** : NE PAS utiliser à la 1re connexion. Force consentement.
- **Refresh token Google** : pas besoin pour FAKT (on génère NOTRE propre JWT après identification). Ne pas stocker le refresh Google.

## Migration vers v0.3 SaaS

Pour SaaS public, il faudra :
- Auto-signup activé (créer user automatiquement si Google email inconnu).
- Domain whitelist optionnelle (`@alphaluppi.com` only par exemple).
- Multi-tenant : créer un workspace par défaut au premier login.
- Audit log des nouveaux users.

## Références

- arctic docs : https://arctic.js.org
- Google OAuth 2.0 : https://developers.google.com/identity/protocols/oauth2/web-server
- OWASP OAuth cheatsheet : https://cheatsheetseries.owasp.org/cheatsheets/OAuth_2_0_Cheat_Sheet.html
