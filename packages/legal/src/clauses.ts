/**
 * Catalogue de clauses contractuelles pré-rédigées (FR).
 *
 * Permet à l'utilisateur de cocher des clauses dans l'éditeur de devis pour
 * les injecter dans le PDF rendu, sans dupliquer de templates Typst pour
 * chaque variante de CGV.
 *
 * Stratégie figée v0.1.x : catalogue en dur. La V0.4+ pourra introduire une
 * table `clause_templates` user-defined avec édition via UI.
 *
 * Les exclusions mutuelles (`excludes`) servent à éviter les contradictions :
 * cocher "Acompte 30 %" décoche automatiquement "Acompte 50 %".
 */

export type ClauseCategory = "payment" | "warranty" | "ip" | "liability" | "jurisdiction";

export interface ClauseDefinition {
  /** Identifiant stable, persistant en DB. Ne jamais renommer après release. */
  id: string;
  category: ClauseCategory;
  /** Libellé court affiché dans la case à cocher. */
  label: string;
  /**
   * Texte injecté dans le PDF — paragraphe FR complet.
   * Reste plain text (pas de markdown) pour rendu Typst direct.
   */
  body: string;
  /** Liste d'IDs mutuellement exclusifs avec celui-ci. */
  excludes?: readonly string[];
}

export const CLAUSE_CATEGORY_LABELS: Record<ClauseCategory, string> = {
  payment: "Paiement",
  warranty: "Garantie",
  ip: "Propriété intellectuelle",
  liability: "Responsabilité",
  jurisdiction: "Juridiction",
};

export const CLAUSE_CATALOG: readonly ClauseDefinition[] = [
  // ─── Paiement / acompte ──────────────────────────────────────────────────
  {
    id: "deposit-30",
    category: "payment",
    label: "Acompte 30 % à la commande",
    body: "Un acompte de 30 % du montant total HT est dû à la signature du présent devis. Le solde sera facturé à livraison des prestations.",
    excludes: ["deposit-50"],
  },
  {
    id: "deposit-50",
    category: "payment",
    label: "Acompte 50 % à la commande",
    body: "Un acompte de 50 % du montant total HT est dû à la signature du présent devis. Le solde sera facturé à livraison des prestations.",
    excludes: ["deposit-30"],
  },

  // ─── Garantie ────────────────────────────────────────────────────────────
  {
    id: "warranty-6",
    category: "warranty",
    label: "Garantie de bon fonctionnement — 6 mois",
    body: "Le prestataire garantit ses livrables contre tout défaut de bon fonctionnement pendant une durée de 6 mois à compter de la réception. Cette garantie ne couvre pas les modifications, intégrations ou usages non prévus initialement.",
    excludes: ["warranty-12"],
  },
  {
    id: "warranty-12",
    category: "warranty",
    label: "Garantie de bon fonctionnement — 12 mois",
    body: "Le prestataire garantit ses livrables contre tout défaut de bon fonctionnement pendant une durée de 12 mois à compter de la réception. Cette garantie ne couvre pas les modifications, intégrations ou usages non prévus initialement.",
    excludes: ["warranty-6"],
  },

  // ─── Propriété intellectuelle ────────────────────────────────────────────
  {
    id: "ip-transfer",
    category: "ip",
    label: "Cession des droits patrimoniaux après paiement",
    body: "Sous réserve du paiement intégral du prix, le prestataire cède au client, à titre exclusif, les droits patrimoniaux (reproduction, représentation, adaptation) sur les livrables finaux, pour la durée légale de protection et pour le monde entier.",
    excludes: ["ip-license"],
  },
  {
    id: "ip-license",
    category: "ip",
    label: "Licence d'utilisation (PI conservée par le prestataire)",
    body: "Le prestataire conserve la pleine et entière propriété intellectuelle des livrables. Le client bénéficie d'une licence d'utilisation perpétuelle, non-exclusive et non-cessible, dans le périmètre du projet décrit au présent devis.",
    excludes: ["ip-transfer"],
  },

  // ─── Responsabilité ──────────────────────────────────────────────────────
  {
    id: "liability-cap",
    category: "liability",
    label: "Limitation de responsabilité au montant du devis",
    body: "La responsabilité du prestataire au titre de la présente prestation est limitée au montant total HT facturé. Le prestataire ne saurait être tenu responsable des dommages indirects (perte d'exploitation, manque à gagner, atteinte à l'image).",
  },

  // ─── Juridiction ─────────────────────────────────────────────────────────
  {
    id: "jurisdiction-fr",
    category: "jurisdiction",
    label: "Juridiction française et résolution amiable préalable",
    body: "Le présent devis est soumis au droit français. En cas de litige, les parties s'engagent à rechercher une solution amiable préalablement à toute action contentieuse. À défaut, les tribunaux du ressort du siège social du prestataire seront seuls compétents.",
  },
];

/**
 * Indexe le catalogue par ID pour des lookups O(1).
 * Re-créé à l'import (le catalogue est figé, pas de refresh nécessaire).
 */
export const CLAUSE_BY_ID: ReadonlyMap<string, ClauseDefinition> = new Map(
  CLAUSE_CATALOG.map((c) => [c.id, c])
);

/**
 * Hydrate une liste d'IDs en définitions complètes.
 * Les IDs inconnus (clauses retirées d'une version future) sont silencieusement
 * ignorés — un devis ancien reste rendable même si on a retiré une clause.
 */
export function hydrateClauses(ids: readonly string[]): ClauseDefinition[] {
  const out: ClauseDefinition[] = [];
  for (const id of ids) {
    const c = CLAUSE_BY_ID.get(id);
    if (c) out.push(c);
  }
  return out;
}

/**
 * Applique les exclusions mutuelles à une nouvelle sélection.
 * Quand on coche un nouvel ID, retire automatiquement ceux qu'il exclut.
 *
 * @param current liste actuelle d'IDs cochés
 * @param toggleId ID à ajouter (cocher) ou retirer (décocher)
 * @returns nouvelle liste d'IDs après application des exclusions
 */
export function toggleClauseWithExclusions(current: readonly string[], toggleId: string): string[] {
  const set = new Set(current);
  if (set.has(toggleId)) {
    set.delete(toggleId);
    return Array.from(set);
  }
  // On ajoute toggleId — d'abord retirer ses excludes
  const def = CLAUSE_BY_ID.get(toggleId);
  if (def?.excludes) {
    for (const ex of def.excludes) set.delete(ex);
  }
  set.add(toggleId);
  return Array.from(set);
}

/**
 * Groupe les clauses du catalogue par catégorie pour l'affichage UI.
 */
export function clausesByCategory(): Record<ClauseCategory, ClauseDefinition[]> {
  const groups: Record<ClauseCategory, ClauseDefinition[]> = {
    payment: [],
    warranty: [],
    ip: [],
    liability: [],
    jurisdiction: [],
  };
  for (const c of CLAUSE_CATALOG) {
    groups[c.category].push(c);
  }
  return groups;
}

/**
 * Sérialise une liste d'IDs vers le format DB (JSON string).
 * `null` quand la liste est vide pour économiser une string vide en DB.
 */
export function serializeClauses(ids: readonly string[]): string | null {
  if (ids.length === 0) return null;
  return JSON.stringify(ids);
}

/**
 * Parse le champ DB `quotes.clauses` (JSON string) vers une liste d'IDs.
 * Fail-safe : retourne `[]` si le JSON est invalide ou null.
 */
export function parseClauses(raw: string | null): string[] {
  if (raw === null || raw === undefined || raw.trim() === "") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}
