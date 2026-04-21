/**
 * Seed de développement : 1 workspace + 3 clients + 5 prestations.
 * À n'exécuter qu'en développement local.
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { workspaces, clients, services } from "../schema/index.js";

const DB_PATH = process.env["FAKT_DEV_DB_PATH"] ?? "./dev.db";

function main(): void {
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite);

  const workspaceId = "00000000-0000-0000-0000-000000000001";
  const now = new Date();
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

  db.insert(workspaces)
    .values({
      id: workspaceId,
      name: "Tom Andrieu",
      legalForm: "Micro-entreprise",
      siret: "73282932000074",
      address: "1 rue de la Paix, 84000 Avignon",
      email: "contact@alphaluppi.com",
      iban: "FR76 3000 6000 0112 3456 7890 189",
      tvaMention: "TVA non applicable, art. 293 B du CGI",
      createdAt: now,
    })
    .onConflictDoNothing()
    .run();

  const clientsData = [
    {
      id: "00000000-0000-0000-0000-000000000010",
      workspaceId,
      name: "CASA MIA",
      legalForm: "SAS",
      siret: null,
      address: "15 avenue de la Gare, 13001 Marseille",
      contactName: "Claire Martin",
      email: "claire@casamia.fr",
      sector: "Hôtellerie",
      firstCollaboration: oneYearAgo,
      note: "Client principal — campagnes saisonnières",
      archivedAt: null,
      createdAt: now,
    },
    {
      id: "00000000-0000-0000-0000-000000000011",
      workspaceId,
      name: "Maison Berthe",
      legalForm: "SARL",
      siret: null,
      address: "8 rue des Artisans, 75011 Paris",
      contactName: "Bertrand Dufour",
      email: "bertrand@maisonberthe.com",
      sector: "Artisanat",
      firstCollaboration: sixMonthsAgo,
      note: "Refonte identité + site vitrine en cours",
      archivedAt: null,
      createdAt: now,
    },
    {
      id: "00000000-0000-0000-0000-000000000012",
      workspaceId,
      name: "Éditions Jocatop",
      legalForm: "SAS",
      siret: null,
      address: "42 boulevard Victor Hugo, 69006 Lyon",
      contactName: "Sophie Renard",
      email: "sophie.renard@jocatop.fr",
      sector: "Édition",
      firstCollaboration: null,
      note: "Prospect chaud — en attente signature devis",
      archivedAt: null,
      createdAt: now,
    },
  ] as const;

  for (const client of clientsData) {
    db.insert(clients).values(client).onConflictDoNothing().run();
  }

  const servicesData = [
    {
      id: "00000000-0000-0000-0000-000000000020",
      workspaceId,
      name: "Site vitrine",
      description: "Conception et intégration d'un site vitrine responsive (design + dev)",
      unit: "forfait" as const,
      unitPriceCents: 350000,
      tags: JSON.stringify(["web", "design", "développement"]),
      archivedAt: null,
      createdAt: now,
    },
    {
      id: "00000000-0000-0000-0000-000000000021",
      workspaceId,
      name: "Journée de développement",
      description: "Développement frontend ou backend à la journée",
      unit: "jour" as const,
      unitPriceCents: 70000,
      tags: JSON.stringify(["développement", "conseil"]),
      archivedAt: null,
      createdAt: now,
    },
    {
      id: "00000000-0000-0000-0000-000000000022",
      workspaceId,
      name: "Maquette UI",
      description: "Conception de maquettes haute fidélité (Figma)",
      unit: "forfait" as const,
      unitPriceCents: 120000,
      tags: JSON.stringify(["design", "UI", "Figma"]),
      archivedAt: null,
      createdAt: now,
    },
    {
      id: "00000000-0000-0000-0000-000000000023",
      workspaceId,
      name: "Audit UX",
      description: "Audit UX complet avec rapport et recommandations",
      unit: "forfait" as const,
      unitPriceCents: 90000,
      tags: JSON.stringify(["UX", "audit", "conseil"]),
      archivedAt: null,
      createdAt: now,
    },
    {
      id: "00000000-0000-0000-0000-000000000024",
      workspaceId,
      name: "Formation",
      description: "Formation sur mesure (outils, process, technologie)",
      unit: "heure" as const,
      unitPriceCents: 15000,
      tags: JSON.stringify(["formation", "pédagogie"]),
      archivedAt: null,
      createdAt: now,
    },
  ];

  for (const service of servicesData) {
    db.insert(services).values(service).onConflictDoNothing().run();
  }

  sqlite.close();
  console.log("Seed dev terminé : 1 workspace + 3 clients + 5 prestations.");
}

main();
