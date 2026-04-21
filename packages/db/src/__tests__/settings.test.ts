import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedWorkspace, WORKSPACE_ID } from "./helpers.js";
import {
  getWorkspace,
  updateWorkspace,
  getSetting,
  setSetting,
  getAllSettings,
} from "../queries/settings.js";
import type { TestDb } from "./helpers.js";

let db: TestDb;

beforeEach(() => {
  ({ db } = createTestDb());
  seedWorkspace(db);
});

describe("getWorkspace", () => {
  it("retourne le workspace existant", () => {
    const ws = getWorkspace(db);
    expect(ws).not.toBeNull();
    expect(ws?.name).toBe("Tom Andrieu Test");
    expect(ws?.siret).toBe("73282932000074");
  });

  it("retourne null si aucun workspace", () => {
    const { db: emptyDb } = createTestDb();
    expect(getWorkspace(emptyDb)).toBeNull();
  });
});

describe("updateWorkspace", () => {
  it("met à jour les champs fournis", () => {
    const updated = updateWorkspace(db, WORKSPACE_ID, { name: "Nouveau Nom", siret: "12345678901234" });
    expect(updated.name).toBe("Nouveau Nom");
    expect(updated.siret).toBe("12345678901234");
  });

  it("préserve les champs non fournis", () => {
    const updated = updateWorkspace(db, WORKSPACE_ID, { name: "Autre" });
    expect(updated.tvaMention).toBe("TVA non applicable, art. 293 B du CGI");
  });

  it("lève une erreur pour un ID inexistant", () => {
    expect(() => updateWorkspace(db, "bad-id", { name: "X" })).toThrow();
  });
});

describe("getSetting / setSetting", () => {
  it("retourne null si la clé n'existe pas", () => {
    expect(getSetting(db, WORKSPACE_ID, "cert_public_pem")).toBeNull();
  });

  it("insère un paramètre et le récupère", () => {
    setSetting(db, WORKSPACE_ID, "cert_public_pem", "-----BEGIN CERTIFICATE-----");
    expect(getSetting(db, WORKSPACE_ID, "cert_public_pem")).toBe("-----BEGIN CERTIFICATE-----");
  });

  it("met à jour un paramètre existant (upsert)", () => {
    setSetting(db, WORKSPACE_ID, "theme", "dark");
    setSetting(db, WORKSPACE_ID, "theme", "light");
    expect(getSetting(db, WORKSPACE_ID, "theme")).toBe("light");
  });
});

describe("getAllSettings", () => {
  it("retourne tous les paramètres du workspace", () => {
    setSetting(db, WORKSPACE_ID, "k1", "v1");
    setSetting(db, WORKSPACE_ID, "k2", "v2");
    const all = getAllSettings(db, WORKSPACE_ID);
    expect(all.length).toBe(2);
    expect(all.some((s) => s.key === "k1" && s.value === "v1")).toBe(true);
    expect(all.some((s) => s.key === "k2" && s.value === "v2")).toBe(true);
  });

  it("retourne tableau vide si aucun paramètre", () => {
    expect(getAllSettings(db, WORKSPACE_ID)).toHaveLength(0);
  });
});
