# Design system — Brutal Invoice

**Audience :** Designer · UX · Dev frontend
**Résumé :** Identité visuelle de FAKT : noir, papier, jaune. Space Grotesk UPPERCASE. Zéro radius. Ombres plates.
**Dernière mise à jour :** 2026-04-25

---

## Philosophie

**Brutal Invoice** est un design system **brutaliste**, **sobre**, et **mémorable**. Pas de Material Design générique, pas de shadcn/ui anonyme. Quand vous voyez l'interface, vous savez immédiatement que c'est FAKT.

Inspirations : Bauhaus, brutalism architecture, calcul typographique français, papier kraft, manuels techniques d'imprimerie.

## Palette de couleurs

| Token | Hex | Rôle |
|---|---|---|
| `--ink` | `#000000` | Encre — bordures, texte principal, ombres |
| `--paper` | `#F5F5F0` | Papier — fond canvas (warm-white légèrement crème) |
| `--accent` | `#FFFF00` | Jaune fluo — alertes, CTA primary, accents |
| `--surface` | `#FFFFFF` | Blanc pur — surfaces raised (cartes, modals) |

**Interdits absolus :**
- ❌ Gradients
- ❌ Blur (filter / backdrop-filter)
- ❌ Border-radius > 0
- ❌ Drop-shadow filters
- ❌ Transparence (sauf scrims modal)
- ❌ Gris subtils — soit noir, soit papier, jamais de variations grises faiblement contrastées

## Typographie

| Famille | Usage | Poids |
|---|---|---|
| **Space Grotesk** | Titres, boutons, labels UI | 700-800 UPPERCASE |
| **Space Grotesk** | Body, paragraphes | 500 |
| **JetBrains Mono** | Numériques, montants, dates, codes | 500-600 |

**Règles :**
- Pas de serif dans l'UI (jamais Times, Georgia, etc.)
- UPPERCASE pour titres et boutons
- `letter-spacing: -0.02em` sur les gros titres (densité brutaliste)
- `font-feature-settings: "tnum"` sur les numériques (chiffres tabulaires)

## Bordures

| Élément | Épaisseur |
|---|---|
| Cards, panels | 2.5px solid `var(--ink)` |
| Boutons, inputs | 2px solid `var(--ink)` |
| Chips, badges | 1.5px solid `var(--ink)` |

**Pas de bordures fines** (< 1.5px) — elles disparaissent visuellement et cassent le brutalisme.

## Ombres

Trois niveaux, **toutes plates** (pas de blur) :

```css
--shadow-sm: 3px 3px 0 #000;
--shadow-md: 5px 5px 0 #000;
--shadow-lg: 8px 8px 0 #000;
```

- `sm` — cards in-place, chips
- `md` — cards principales, modals
- `lg` — éléments mis en avant, dropdowns

**Jamais de blur** (`box-shadow: 0 0 10px rgba(0,0,0,.1)` est interdit).

## Radii

```css
--radius-none: 0px;
```

C'est tout. Pas de variations. Seule exception tolérée : loaders circulaires (techniquement requis par le pattern d'animation).

## Interactions

### Hover

Inversion `--ink` ↔ `--accent` :

```css
button {
  background: var(--accent);
  color: var(--ink);
  border: 2px solid var(--ink);
  box-shadow: 3px 3px 0 var(--ink);
}
button:hover {
  background: var(--ink);
  color: var(--accent);
}
```

### Press / Active

Translation + suppression de l'ombre (effet "le bouton s'enfonce") :

```css
button:active {
  transform: translate(3px, 3px);
  box-shadow: none;
}
```

### Focus

Outline jaune épaisse :

```css
button:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}
```

## Composants primitifs

Implémentés dans `packages/ui/` :

- `<Button variant="primary|secondary|danger">` — boutons Brutal Invoice
- `<Input>` — input avec bordure 2px noir
- `<Card>` — carte avec bordure 2.5px + ombre 5px
- `<Modal>` — modal avec scrim semi-transparent + carte centrée
- `<Badge>` — chip 1.5px bordure
- `<Tooltip>` — tooltip Brutal Invoice
- `<SegmentedControl>` — radio horizontal segmenté
- `<Dropdown>` — menu déroulant Brutal

Code source : [`packages/ui/src/`](../../packages/ui/src/).

## Tokens — Tailwind v4 plugin

Les tokens sont exposés via le plugin Tailwind dans `packages/design-tokens/` :

```ts
// tailwind.config.ts du package
import faktTokens from "@fakt/design-tokens";

export default {
  plugins: [faktTokens],
};
```

Vous pouvez ensuite utiliser :

```tsx
<div className="bg-paper border-2 border-ink shadow-md">
  <h1 className="font-ui font-bold uppercase tracking-tight">FAKT</h1>
</div>
```

## Guidelines pour les nouveaux composants

1. **Toujours noir + papier comme base.** Le jaune est un accent, pas une couleur de fond.
2. **Toujours bordure visible.** Si vous hésitez sur une bordure, ajoutez-la.
3. **Toujours UPPERCASE pour titres et boutons.** Body en lowercase.
4. **Toujours ombre plate** (pas de blur, jamais).
5. **Hover = inversion noir ↔ jaune.** Les autres interactions sont secondaires.
6. **Press = translate(3px, 3px) + shadow:none.** Donne l'illusion physique du papier qui s'enfonce.
7. **Focus = outline 3px jaune.** Accessibilité non négociable.

## Inspirations / références

- [Brutalist Websites](https://brutalistwebsites.com)
- Bauhaus typography manuals
- Le Corbusier's Modulor
- French invoice template lineage

## Pour aller plus loin

- [`packages/design-tokens/`](../../packages/design-tokens/) — source des tokens
- [`packages/ui/`](../../packages/ui/) — composants primitifs
- [`.design-ref/`](../../.design-ref/) — bundle design original (Anthropic)
- [features.md](features.md) — fonctionnalités produit
- [architecture-overview.md](architecture-overview.md) — vue technique
