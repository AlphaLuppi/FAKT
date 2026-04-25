# Conventions de test — testids UI

**Statut :** v0.1.17, contraignant. Toute PR qui introduit un élément interactable sans `data-testid` ou avec un naming non conforme doit être recalée en review.

## Pourquoi `data-testid` plutôt qu'autre chose

- **Pas `id="..."`** : les `id` HTML doivent être uniques sur la page, donc inapplicables aux listes (chaque `<tr>` ne peut pas avoir le même id).
- **Pas les labels accessibles seuls** : les libellés français évoluent (refactor copy, traductions futures), un test qui matche `/dénomination|nom de l'entreprise/i` casse au prochain rewording produit.
- **Pas les classes CSS** : couplées à l'implémentation visuelle, elles changent avec le design.
- **`data-testid`** : explicite, stable, ignoré du SEO et de l'accessibilité, supporté nativement par Playwright (`page.getByTestId`) et WebdriverIO (`$("[data-testid='...']")`).

## Quels éléments DOIVENT avoir un `data-testid`

Tout élément que l'utilisateur peut **cibler ou identifier** dans un test :

| Catégorie | Exemples | Obligatoire |
|---|---|---|
| Boutons | `<button>`, primary CTA, secondary, icon button | Oui |
| Inputs de formulaire | `<input>`, `<textarea>`, `<select>` | Oui |
| Liens de navigation | `<a>` qui change de route | Oui |
| Onglets | `<button role="tab">`, `<a>` dans une nav | Oui |
| Items de menu / dropdown / autocomplete | `<button role="option">`, `<li>` cliquable | Oui |
| Modals & overlays | wrapper de la modal, bouton close | Oui |
| Lignes de liste / cards dynamiques | `<tr>`, `<article>` représentant une entité | Oui (avec suffixe `-{id}`) |
| Status / badge / chip | `<StatusPill>`, `<Chip>` qui change selon le state | Oui (lecture seule mais utile pour assertions) |
| Wrapper de page | `<main>` ou `<section>` racine d'une route | Recommandé |
| Layout pur (div wrapper, span décoratif) | bordures, espacements, séparateurs | Non |
| Texte statique | titres, paragraphes informatifs | Non (sauf si dynamique et asserté) |

## Pattern de naming

Format général :

```
<feature>-<element>[-<modifier>][-{dynamic-id}]
```

- **Tout en kebab-case**, ASCII pur (pas d'accent).
- **`<feature>`** : la zone fonctionnelle. Mots clés autorisés : `wizard`, `wizard-identity`, `wizard-claudecli`, `wizard-certificate`, `wizard-recap`, `siret-checker`, `auth`, `login`, `dashboard`, `quotes`, `quote-form`, `quote-detail`, `quote-list`, `quote-new`, `quote-new-manual`, `quote-new-ai`, `invoices`, `invoice-form`, `invoice-detail`, `invoice-list`, `invoice-new`, `invoice-new-manual`, `invoice-new-scratch`, `invoice-new-ai`, `invoice-new-from-quote`, `invoice-mark-paid-modal`, `clients`, `client-form`, `client-detail`, `client-list`, `client-picker`, `quick-client`, `items-editor`, `services`, `service-form`, `service-list`, `archive`, `signatures`, `signature-modal`, `signature-canvas`, `signature-verify`, `settings`, `settings-identity`, `settings-certificate`, `settings-backend`, `settings-claudecli`, `settings-telemetry`, `settings-ai`, `composer`, `command-palette`, `prepare-email-modal`, `nav`, `topbar`, `sidebar`, `shell`, `update-banner`, `update-modal`, `audit-timeline`, `shortcuts-overlay`, `error-boundary`, `toast`.
- **`<element>`** : ce que c'est. `submit`, `cancel`, `name`, `email`, `password`, `siret`, `add-line`, `delete`, `edit`, `mark-paid`, `convert`, `sign`, `download-pdf`, `send-email`, `next`, `prev`, `client-picker`, `client-option`, `tab-identity`, etc.
- **`<modifier>`** facultatif quand plusieurs variantes coexistent : `submit-primary`, `submit-confirm`, `cancel-secondary`. À éviter quand non ambigu.
- **`{dynamic-id}`** suffixe pour les listes / éléments paramétrés. Toujours en dernier, séparé par `-`. Utiliser l'`id` métier (cli-001, q-001) ou un index stable.

### Exemples canoniques

```tsx
// Forms simples
<input data-testid="login-email" type="email" />
<input data-testid="login-password" type="password" />
<button data-testid="login-submit">Se connecter</button>

// Wizard
<input data-testid="wizard-identity-name" />
<input data-testid="wizard-identity-siret" />
<button data-testid="wizard-next">Suivant</button>
<button data-testid="wizard-prev">Précédent</button>
<button data-testid="wizard-finish">Terminer</button>

// Listes dynamiques (id = id métier de l'entité)
<tr data-testid={`quote-list-row-${quote.id}`}>
  <a data-testid={`quote-list-link-${quote.id}`} href={`/quotes/${quote.id}`}>
    {quote.number}
  </a>
</tr>

// Détail d'un document
<button data-testid="quote-detail-sign">Signer</button>
<button data-testid="quote-detail-convert">Convertir en facture</button>
<button data-testid="quote-detail-download-pdf">Télécharger le PDF</button>
<button data-testid="invoice-detail-mark-paid">Marquer payée</button>

// Form devis / facture
<button data-testid="quote-form-add-line">Ajouter une ligne</button>
<input data-testid="quote-form-line-description-0" />
<input data-testid="quote-form-line-quantity-0" />
<input data-testid="quote-form-line-unit-price-0" />
<button data-testid="quote-form-line-remove-0">Supprimer</button>
<button data-testid="quote-form-submit">Enregistrer</button>

// Tabs
<button role="tab" data-testid="settings-tab-identity">Identité</button>
<button role="tab" data-testid="settings-tab-backend">Backend</button>

// Modal
<div role="dialog" data-testid="signature-modal">
  <canvas data-testid="signature-modal-canvas" />
  <button data-testid="signature-modal-clear">Effacer</button>
  <button data-testid="signature-modal-submit">Signer</button>
  <button data-testid="signature-modal-close">Fermer</button>
</div>

// Nav
<aside data-testid="sidebar">
  <a data-testid="sidebar-link-dashboard" href="/">Tableau de bord</a>
  <a data-testid="sidebar-link-quotes" href="/quotes">Devis</a>
  <a data-testid="sidebar-link-invoices" href="/invoices">Factures</a>
</aside>

// Status (lecture seule)
<span data-testid={`invoice-list-row-${id}-status`}>Payée</span>
```

## Règles de propagation dans les composants `@fakt/ui`

Les primitives (`Button`, `Input`, `Select`, `Textarea`, `Checkbox`, `Radio`) **doivent** propager `data-testid` au DOM natif via spread des `...rest` props. C'est déjà le cas pour `Button` (cf. [packages/ui/src/primitives/Button.tsx:24](packages/ui/src/primitives/Button.tsx)). Tout nouveau composant primitive doit suivre la même règle :

```tsx
export interface MonComposantProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  // props spécifiques
}

export const MonComposant = forwardRef<HTMLButtonElement, MonComposantProps>(function MonComposant(
  { /* props spécifiques */, ...rest },
  ref
) {
  return <button ref={ref} {...rest} />;  // ← rest contient data-testid
});
```

Si un composant wrapper (Modal, Card) a besoin d'un `data-testid` côté wrapper ET côté contenu, exposer un prop `testid` ou `dataTestId` qui produit deux attributs (ex. `data-testid="signature-modal"` sur la div, `data-testid="signature-modal-content"` sur le body). À éviter quand un seul testid suffit.

## Comment l'utiliser dans les tests

### Playwright

```ts
await page.getByTestId("wizard-next").click();
await page.getByTestId("login-email").fill("user@example.com");
await expect(page.getByTestId(`quote-list-row-${quoteId}`)).toBeVisible();
```

### WebdriverIO (release suite)

```ts
const btn = await browser.$('[data-testid="wizard-next"]');
await btn.click();
```

### Vitest + Testing Library

```tsx
const submit = screen.getByTestId("login-submit");
await user.click(submit);
```

## Anti-patterns à refuser en review

- `data-testid="button"`, `data-testid="input1"` → trop générique, on ne sait pas dans quelle feature
- `data-testid="MyComponent"` → casing non conforme, doit être kebab-case
- `data-testid="loginForm.submit"` → `.` interdit, séparateur unique = `-`
- `data-testid={Math.random()}` → instable, injecte un nouveau testid à chaque render
- `data-testid="btn-1"` quand on parle du bouton submit du formulaire login → utiliser le pattern `<feature>-<element>` (`login-submit`)
- Dupliquer le testid sur plusieurs éléments non listables (ex. deux `<button data-testid="cancel">` dans deux modals différentes) — préfixer par feature

## Évolution du pattern

Si une convention nouvelle est nécessaire (ex. nouvelle feature majeure avec des conventions internes), ajouter une section ici, ne pas dévier silencieusement. Les noms de feature autorisés sont la source de vérité — tout nouveau préfixe doit être ajouté dans cette doc avant d'être utilisé.
