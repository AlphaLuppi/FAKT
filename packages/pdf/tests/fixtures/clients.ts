/**
 * Fixtures de clients pour couvrir les 3 scénarios :
 *   - nominal (client FR avec tous les champs)
 *   - intl hors-UE (TVA optionnelle, adresse étrangère)
 *   - minimal (nom seul, champs nullable laissés null)
 */
import type { ClientInput } from "@fakt/core";

export const clientNominal: ClientInput = {
  id: "00000000-0000-0000-0000-000000000101",
  workspaceId: "00000000-0000-0000-0000-000000000001",
  name: "CASA MIA SARL",
  legalForm: "SARL",
  siret: "89513306400017",
  address: "51 rue Laurent Bertrand, 84320 Entraigues-sur-la-Sorgue",
  contactName: "Marco Bianchi",
  email: "contact@casamia-pizzeriatraiteur.fr",
  sector: "Restauration",
  firstCollaboration: 1704067200000,
  note: null,
  archivedAt: null,
  createdAt: 1700000000000,
};

export const clientIntl: ClientInput = {
  id: "00000000-0000-0000-0000-000000000102",
  workspaceId: "00000000-0000-0000-0000-000000000001",
  name: "Acme Corporation Inc.",
  legalForm: "Inc.",
  siret: null,
  address: "1600 Pennsylvania Avenue NW, Washington, DC 20500, USA",
  contactName: "Jane Smith",
  email: "jane@acme.example",
  sector: "Tech",
  firstCollaboration: null,
  note: "Client hors-UE — pas de SIRET",
  archivedAt: null,
  createdAt: 1700000000000,
};

export const clientMinimal: ClientInput = {
  id: "00000000-0000-0000-0000-000000000103",
  workspaceId: "00000000-0000-0000-0000-000000000001",
  name: "Jean Dupont",
  legalForm: null,
  siret: null,
  address: null,
  contactName: null,
  email: null,
  sector: null,
  firstCollaboration: null,
  note: null,
  archivedAt: null,
  createdAt: 1700000000000,
};
