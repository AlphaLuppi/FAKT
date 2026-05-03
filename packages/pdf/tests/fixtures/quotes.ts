/**
 * 3 fixtures de devis :
 *   - quoteSimple : 1 ligne forfait (nominal)
 *   - quoteLong : 20 lignes (stress-test pagination)
 *   - quoteIntl : devis pour client hors-UE
 */
import type { DocumentLineInput, QuoteInput } from "@fakt/core";

const ts = (iso: string) => new Date(iso).getTime();

function line(
  position: number,
  description: string,
  qtyMilli: number,
  unit: DocumentLineInput["unit"],
  unitPriceCents: number
): DocumentLineInput {
  return {
    id: `00000000-0000-0000-0000-${position.toString().padStart(12, "0")}`,
    position,
    description,
    quantity: qtyMilli,
    unitPriceCents,
    unit,
    lineTotalCents: Math.round((qtyMilli * unitPriceCents) / 1000),
    serviceId: null,
  };
}

// ─── Quote 1 : nominal ─────────────────────────────────────────────────────
export const quoteSimple: QuoteInput = {
  id: "10000000-0000-0000-0000-000000000001",
  workspaceId: "00000000-0000-0000-0000-000000000001",
  clientId: "00000000-0000-0000-0000-000000000101",
  number: "D2026-001",
  year: 2026,
  sequence: 1,
  title: "Refonte site vitrine casamia-pizzeriatraiteur.fr",
  status: "sent",
  totalHtCents: 250000,
  conditions: "Acompte de 30 % à la commande. Solde à réception. Délai de paiement : 30 jours.",
  clauses: [],
  validityDate: ts("2026-05-21T00:00:00Z"),
  notes: "Prestation incluant 2 allers-retours de révision.",
  issuedAt: ts("2026-04-21T00:00:00Z"),
  signedAt: null,
  archivedAt: null,
  createdAt: ts("2026-04-21T00:00:00Z"),
  updatedAt: ts("2026-04-21T00:00:00Z"),
  items: [
    line(1, "Refonte responsive du site vitrine (design + intégration)", 1000, "forfait", 250000),
  ],
};

// ─── Quote 2 : long (20 lignes) ─────────────────────────────────────────────
export const quoteLong: QuoteInput = {
  id: "10000000-0000-0000-0000-000000000002",
  workspaceId: "00000000-0000-0000-0000-000000000001",
  clientId: "00000000-0000-0000-0000-000000000101",
  number: "D2026-002",
  year: 2026,
  sequence: 2,
  title: "Développement application métier interne — lot complet",
  status: "sent",
  totalHtCents: 0, // calculé plus bas
  conditions: "Acompte 1/3. Paiement 30j. 2 allers-retours par phase.",
  clauses: [],
  validityDate: ts("2026-06-01T00:00:00Z"),
  notes: null,
  issuedAt: ts("2026-04-21T00:00:00Z"),
  signedAt: null,
  archivedAt: null,
  createdAt: ts("2026-04-21T00:00:00Z"),
  updatedAt: ts("2026-04-21T00:00:00Z"),
  items: Array.from({ length: 20 }, (_, i) =>
    line(
      i + 1,
      `Phase ${i + 1} — livrable technique détaillé (module ${String.fromCharCode(65 + (i % 26))})`,
      1000 + i * 250,
      i % 3 === 0 ? "jour" : "forfait",
      50000 + i * 2500
    )
  ),
};
// Pré-calcul totalHt :
quoteLong.totalHtCents = quoteLong.items.reduce((acc, it) => acc + it.lineTotalCents, 0);

// ─── Quote 3 : intl hors-UE ─────────────────────────────────────────────────
export const quoteIntl: QuoteInput = {
  id: "10000000-0000-0000-0000-000000000003",
  workspaceId: "00000000-0000-0000-0000-000000000001",
  clientId: "00000000-0000-0000-0000-000000000102",
  number: "D2026-003",
  year: 2026,
  sequence: 3,
  title: "Dashboard analytics — mission longue durée",
  status: "draft",
  totalHtCents: 720000,
  conditions: "Payment due within 30 days. Currency : EUR. Services invoiced from France.",
  clauses: [],
  validityDate: ts("2026-07-01T00:00:00Z"),
  notes: "Outside-EU client — no VAT applicable (art. 293 B CGI).",
  issuedAt: ts("2026-04-21T00:00:00Z"),
  signedAt: null,
  archivedAt: null,
  createdAt: ts("2026-04-21T00:00:00Z"),
  updatedAt: ts("2026-04-21T00:00:00Z"),
  items: [
    line(1, "Discovery workshop (2 sessions)", 1000, "forfait", 150000),
    line(2, "Dashboard implementation (React + TanStack)", 12000, "jour", 47500),
    line(3, "Documentation + handover", 1000, "forfait", 12500),
  ],
};
