/**
 * Fixtures de workspace réalistes pour les tests PDF.
 * Aligné avec les skills legacy — Tom Andrieu en Avignon.
 */
import type { WorkspaceInput } from "@fakt/core";

export const fixtureWorkspace: WorkspaceInput = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Tom Andrieu",
  legalForm: "Micro-entreprise",
  siret: "85366584200029",
  address: "67 route de Lyon, 84000 Avignon",
  email: "contact@alphaluppi.com",
  iban: "FR76 2823 3000 0149 3263 1396 047",
  tvaMention: "TVA non applicable, art. 293 B du CGI",
  createdAt: 1700000000000,
};
