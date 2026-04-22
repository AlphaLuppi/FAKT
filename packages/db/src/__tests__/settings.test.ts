import { beforeEach, describe, expect, it } from "vitest";
import {
  createWorkspace,
  getAllSettings,
  getSetting,
  getWorkspace,
  setSetting,
  updateWorkspace,
} from "../queries/settings.js";
import { WORKSPACE_ID, createTestDb, seedWorkspace } from "./helpers.js";
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

describe("createWorkspace", () => {
  it("insère un workspace avec la mention TVA micro-entreprise par défaut", () => {
    const { db: freshDb } = createTestDb();
    const ws = createWorkspace(freshDb, {
      id: "00000000-0000-0000-0000-0000000000aa",
      name: "Atelier Test",
      legalForm: "Micro-entreprise",
      siret: "81234567800014",
      address: "12 rue du Test, 75001 Paris",
      email: "hello@atelier.fr",
    });

    expect(ws.id).toBe("00000000-0000-0000-0000-0000000000aa");
    expect(ws.name).toBe("Atelier Test");
    expect(ws.tvaMention).toBe("TVA non applicable, art. 293 B du CGI");
    expect(ws.iban).toBeNull();
    expect(ws.createdAt).toBeGreaterThan(0);

    const reread = getWorkspace(freshDb);
    expect(reread?.id).toBe(ws.id);
  });

  it("respecte les champs optionnels fournis (iban, tvaMention custom)", () => {
    const { db: freshDb } = createTestDb();
    const ws = createWorkspace(freshDb, {
      id: "00000000-0000-0000-0000-0000000000bb",
      name: "SARL Test",
      legalForm: "SARL",
      siret: "82345678900019",
      address: "5 avenue TVA, 69002 Lyon",
      email: "contact@sarl.fr",
      iban: "FR7612345987650123456789014",
      tvaMention: "TVA intracommunautaire FR12345678900",
    });

    expect(ws.iban).toBe("FR7612345987650123456789014");
    expect(ws.tvaMention).toBe("TVA intracommunautaire FR12345678900");
    expect(ws.legalForm).toBe("SARL");
  });

  it("lève une erreur si un workspace avec le même ID existe déjà", () => {
    // `seedWorkspace` a inséré WORKSPACE_ID dans `beforeEach`.
    expect(() =>
      createWorkspace(db, {
        id: WORKSPACE_ID,
        name: "Conflit",
        legalForm: "Micro-entreprise",
        siret: "11111111111111",
        address: "X",
        email: "conflit@test.fr",
      })
    ).toThrow();
  });
});

describe("updateWorkspace", () => {
  it("met à jour les champs fournis", () => {
    const updated = updateWorkspace(db, WORKSPACE_ID, {
      name: "Nouveau Nom",
      siret: "12345678901234",
    });
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
