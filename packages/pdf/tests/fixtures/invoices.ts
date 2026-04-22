/**
 * 3 fixtures de factures :
 *   - invoiceSimple : nominal (1 ligne)
 *   - invoiceLong : 20 lignes
 *   - invoiceIntl : hors-UE
 *
 * Toutes intègrent le snapshot `legalMentions` exactement comme le produirait
 * `buildLegalMentionsSnapshot` de @fakt/legal — format testable byte-pour-byte.
 */
import type { DocumentLineInput, InvoiceInput } from "@fakt/core";

const ts = (iso: string) => new Date(iso).getTime();

function line(
  position: number,
  description: string,
  qtyMilli: number,
  unit: DocumentLineInput["unit"],
  unitPriceCents: number
): DocumentLineInput {
  return {
    id: `00000000-0000-0000-0000-${(position + 500).toString().padStart(12, "0")}`,
    position,
    description,
    quantity: qtyMilli,
    unitPriceCents,
    unit,
    lineTotalCents: Math.round((qtyMilli * unitPriceCents) / 1000),
    serviceId: null,
  };
}

// Snapshot de mentions légales conforme à buildLegalMentionsSnapshot.
const legalMentionsSnapshot = [
  "Micro-entreprise Tom Andrieu",
  "SIRET : 85366584200029",
  "67 route de Lyon, 84000 Avignon",
  "IBAN : FR76 2823 3000 0149 3263 1396 047",
  "TVA non applicable, art. 293 B du CGI",
  "Paiement à 30 jours date de facture.",
  "En cas de retard de paiement, une pénalité égale à 3 fois le taux d'intérêt légal sera appliquée.",
  "Une indemnité forfaitaire de 40 € sera due pour frais de recouvrement en cas de retard (D. n° 2012-1115).",
].join("\n");

// ─── Invoice 1 : simple ─────────────────────────────────────────────────────
export const invoiceSimple: InvoiceInput = {
  id: "20000000-0000-0000-0000-000000000001",
  workspaceId: "00000000-0000-0000-0000-000000000001",
  clientId: "00000000-0000-0000-0000-000000000101",
  quoteId: "10000000-0000-0000-0000-000000000001",
  number: "F2026-001",
  year: 2026,
  sequence: 1,
  kind: "total",
  depositPercent: null,
  title: "Refonte site vitrine casamia-pizzeriatraiteur.fr — Livraison",
  status: "sent",
  totalHtCents: 250000,
  dueDate: ts("2026-05-21T00:00:00Z"),
  paidAt: null,
  paymentMethod: "wire",
  legalMentions: legalMentionsSnapshot,
  issuedAt: ts("2026-04-21T00:00:00Z"),
  archivedAt: null,
  createdAt: ts("2026-04-21T00:00:00Z"),
  updatedAt: ts("2026-04-21T00:00:00Z"),
  items: [
    line(1, "Refonte responsive du site vitrine (design + intégration)", 1000, "forfait", 250000),
  ],
};

// ─── Invoice 2 : long ───────────────────────────────────────────────────────
export const invoiceLong: InvoiceInput = {
  id: "20000000-0000-0000-0000-000000000002",
  workspaceId: "00000000-0000-0000-0000-000000000001",
  clientId: "00000000-0000-0000-0000-000000000101",
  quoteId: null,
  number: "F2026-002",
  year: 2026,
  sequence: 2,
  kind: "total",
  depositPercent: null,
  title: "Développement application métier — livraison intégrale",
  status: "sent",
  totalHtCents: 0,
  dueDate: ts("2026-06-01T00:00:00Z"),
  paidAt: null,
  paymentMethod: "wire",
  legalMentions: legalMentionsSnapshot,
  issuedAt: ts("2026-04-21T00:00:00Z"),
  archivedAt: null,
  createdAt: ts("2026-04-21T00:00:00Z"),
  updatedAt: ts("2026-04-21T00:00:00Z"),
  items: Array.from({ length: 20 }, (_, i) =>
    line(
      i + 1,
      `Phase ${i + 1} — livrable technique (module ${String.fromCharCode(65 + (i % 26))})`,
      1000 + i * 250,
      i % 3 === 0 ? "jour" : "forfait",
      50000 + i * 2500
    )
  ),
};
invoiceLong.totalHtCents = invoiceLong.items.reduce((a, i) => a + i.lineTotalCents, 0);

// ─── Invoice 3 : intl ───────────────────────────────────────────────────────
export const invoiceIntl: InvoiceInput = {
  id: "20000000-0000-0000-0000-000000000003",
  workspaceId: "00000000-0000-0000-0000-000000000001",
  clientId: "00000000-0000-0000-0000-000000000102",
  quoteId: null,
  number: "F2026-003",
  year: 2026,
  sequence: 3,
  kind: "total",
  depositPercent: null,
  title: "Dashboard analytics — livrable final",
  status: "sent",
  totalHtCents: 720000,
  dueDate: ts("2026-05-21T00:00:00Z"),
  paidAt: null,
  paymentMethod: "wire",
  legalMentions: legalMentionsSnapshot,
  issuedAt: ts("2026-04-21T00:00:00Z"),
  archivedAt: null,
  createdAt: ts("2026-04-21T00:00:00Z"),
  updatedAt: ts("2026-04-21T00:00:00Z"),
  items: [
    line(1, "Discovery workshop (2 sessions)", 1000, "forfait", 150000),
    line(2, "Dashboard implementation (React + TanStack)", 12000, "jour", 47500),
    line(3, "Documentation + handover", 1000, "forfait", 12500),
  ],
};
