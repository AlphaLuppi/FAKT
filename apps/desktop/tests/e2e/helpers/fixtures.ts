/**
 * Fixtures de données partagées par toutes les specs E2E.
 *
 * Les types proviennent de `@fakt/shared` — toute divergence avec le vrai
 * domaine fait échouer les tests silencieusement (l'UI ne sait pas afficher
 * un objet partiellement typé). Si un champ change côté shared, ces fixtures
 * doivent suivre.
 *
 * Aucune donnée nominative ne doit ici référencer un user réel — fixtures
 * génériques uniquement (cf. memory `feedback_no_branding_in_app.md`).
 */

import type { Client, Invoice, Quote, Service, Workspace } from "@fakt/shared";

// IDs courts au lieu d'UUIDs — beaucoup plus pratique pour les specs
// (`getByTestId("quote-list-row-q-001")` lisible vs UUID). Le sidecar n'est
// pas appelé en dev mode (mocks), donc pas de validation UUID stricte.
export const FIXTURE_WORKSPACE: Workspace = {
  id: "ws-001",
  name: "Mon Entreprise",
  legalForm: "Micro-entreprise",
  siret: "73282932000074",
  address: "12 rue de la République\n13001 Marseille",
  email: "contact@monentreprise.fr",
  iban: "FR7630006000011234567890189",
  tvaMention: "TVA non applicable, art. 293 B du CGI",
  createdAt: 1735689600000,
};

export const FIXTURE_CLIENTS: Client[] = [
  {
    id: "cli-001",
    workspaceId: FIXTURE_WORKSPACE.id,
    name: "Acme SAS",
    legalForm: "SAS",
    siret: "12345678900012",
    address: "1 avenue des Champs-Élysées, 75008 Paris",
    contactName: "Alice Martin",
    email: "achat@acme.fr",
    sector: "Industrie",
    firstCollaboration: 1735776000000,
    note: null,
    archivedAt: null,
    createdAt: 1735776000000,
  },
  {
    id: "cli-002",
    workspaceId: FIXTURE_WORKSPACE.id,
    name: "Beta Studio EURL",
    legalForm: "EURL",
    siret: "98765432100021",
    address: "42 boulevard Voltaire, 75011 Paris",
    contactName: "Boris Lemoine",
    email: "facturation@betastudio.io",
    sector: "Design",
    firstCollaboration: 1735862400000,
    note: null,
    archivedAt: null,
    createdAt: 1735862400000,
  },
];

export const FIXTURE_SERVICES: Service[] = [
  {
    id: "srv-001",
    workspaceId: FIXTURE_WORKSPACE.id,
    name: "Développement web — jour",
    description: "Tarif journalier dev fullstack",
    unit: "jour",
    unitPriceCents: 60000,
    tags: ["dev", "fullstack"],
    archivedAt: null,
    createdAt: 1735776000000,
  },
  {
    id: "srv-002",
    workspaceId: FIXTURE_WORKSPACE.id,
    name: "Audit technique",
    description: "Audit codebase + livrable PDF",
    unit: "forfait",
    unitPriceCents: 120000,
    tags: ["audit"],
    archivedAt: null,
    createdAt: 1735776000000,
  },
];

export const FIXTURE_QUOTES: Quote[] = [
  {
    id: "q-001",
    workspaceId: FIXTURE_WORKSPACE.id,
    clientId: FIXTURE_CLIENTS[0].id,
    number: "D2026-001",
    year: 2026,
    sequence: 1,
    title: "Développement v1",
    // Status `sent` : permet de tester le bouton Signer sur le détail
    // (un draft cache le bouton tant que pas émis).
    status: "sent",
    totalHtCents: 600000,
    conditions: null,
    validityDate: 1738368000000,
    notes: null,
    issuedAt: 1735862400000,
    signedAt: null,
    archivedAt: null,
    createdAt: 1735862400000,
    updatedAt: 1735862400000,
    items: [
      {
        id: "qi-001",
        position: 0,
        description: "Développement v1 (10 jours)",
        quantity: 10000,
        unitPriceCents: 60000,
        unit: "jour",
        lineTotalCents: 600000,
        serviceId: null,
      },
    ],
  },
  {
    id: "q-002",
    workspaceId: FIXTURE_WORKSPACE.id,
    clientId: FIXTURE_CLIENTS[1].id,
    number: "D2026-002",
    year: 2026,
    sequence: 2,
    title: "Audit + recommandations",
    status: "signed",
    totalHtCents: 120000,
    conditions: null,
    validityDate: 1738454400000,
    notes: null,
    issuedAt: 1735948800000,
    signedAt: 1736035200000,
    archivedAt: null,
    createdAt: 1735948800000,
    updatedAt: 1736035200000,
    items: [
      {
        id: "qi-002",
        position: 0,
        description: "Audit + recommandations",
        quantity: 1000,
        unitPriceCents: 120000,
        unit: "forfait",
        lineTotalCents: 120000,
        serviceId: null,
      },
    ],
  },
];

export const FIXTURE_INVOICES: Invoice[] = [
  {
    id: "inv-001",
    workspaceId: FIXTURE_WORKSPACE.id,
    clientId: FIXTURE_CLIENTS[0].id,
    quoteId: null,
    number: "F2026-001",
    year: 2026,
    sequence: 1,
    kind: "independent",
    depositPercent: null,
    title: "Acompte 30 %",
    status: "sent",
    totalHtCents: 180000,
    dueDate: 1738627200000,
    paidAt: null,
    paymentMethod: null,
    paymentNotes: null,
    legalMentions: "TVA non applicable, art. 293 B du CGI",
    issuedAt: 1736035200000,
    archivedAt: null,
    createdAt: 1736035200000,
    updatedAt: 1736035200000,
    items: [
      {
        id: "ii-001",
        position: 0,
        description: "Acompte 30 %",
        quantity: 1000,
        unitPriceCents: 180000,
        unit: "forfait",
        lineTotalCents: 180000,
        serviceId: null,
      },
    ],
  },
];

/**
 * Helper pour générer un UUID v4 simplifié sans dependency `crypto.randomUUID`
 * (qui peut être absent dans certains contextes Playwright).
 */
export function genUuid(): string {
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 32; i++) {
    if (i === 8 || i === 12 || i === 16 || i === 20) out += "-";
    out += hex[Math.floor(Math.random() * 16)];
  }
  return out;
}
