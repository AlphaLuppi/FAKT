import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedWorkspace, WORKSPACE_ID, SERVICE_ID_1 } from "./helpers.js";
import {
  listPrestations,
  getPrestation,
  createPrestation,
  updatePrestation,
  softDeletePrestation,
  searchPrestations,
} from "../queries/prestations.js";
import type { TestDb } from "./helpers.js";

let db: TestDb;

beforeEach(() => {
  ({ db } = createTestDb());
  seedWorkspace(db);
});

const SVC_2 = "00000000-0000-0000-0000-000000000021";

function makeService(id = SERVICE_ID_1) {
  return createPrestation(db, {
    id,
    workspaceId: WORKSPACE_ID,
    name: "Journée dev",
    unit: "jour",
    unitPriceCents: 70000,
    tags: ["développement"],
  });
}

describe("createPrestation", () => {
  it("crée une prestation et la retourne typée", () => {
    const svc = makeService();
    expect(svc.id).toBe(SERVICE_ID_1);
    expect(svc.unitPriceCents).toBe(70000);
    expect(svc.tags).toEqual(["développement"]);
    expect(svc.archivedAt).toBeNull();
  });

  it("accepte des tags null", () => {
    const svc = createPrestation(db, {
      id: SVC_2,
      workspaceId: WORKSPACE_ID,
      name: "Forfait sans tags",
      unit: "forfait",
      unitPriceCents: 150000,
    });
    expect(svc.tags).toBeNull();
  });
});

describe("getPrestation", () => {
  it("retourne la prestation par ID", () => {
    makeService();
    expect(getPrestation(db, SERVICE_ID_1)?.name).toBe("Journée dev");
  });

  it("retourne null pour un ID inexistant", () => {
    expect(getPrestation(db, "non-existant")).toBeNull();
  });
});

describe("listPrestations", () => {
  beforeEach(() => {
    makeService(SERVICE_ID_1);
    makeService(SVC_2);
  });

  it("liste les prestations actives", () => {
    expect(listPrestations(db, { workspaceId: WORKSPACE_ID })).toHaveLength(2);
  });

  it("exclut les archivées par défaut", () => {
    softDeletePrestation(db, SERVICE_ID_1);
    expect(listPrestations(db, { workspaceId: WORKSPACE_ID })).toHaveLength(1);
  });

  it("inclut les archivées si demandé", () => {
    softDeletePrestation(db, SERVICE_ID_1);
    expect(listPrestations(db, { workspaceId: WORKSPACE_ID, includeSoftDeleted: true })).toHaveLength(2);
  });
});

describe("updatePrestation", () => {
  beforeEach(() => makeService());

  it("met à jour les champs fournis", () => {
    const updated = updatePrestation(db, SERVICE_ID_1, { unitPriceCents: 75000, tags: ["dev", "conseil"] });
    expect(updated.unitPriceCents).toBe(75000);
    expect(updated.tags).toEqual(["dev", "conseil"]);
  });

  it("lève une erreur pour un ID inexistant", () => {
    expect(() => updatePrestation(db, "bad-id", { name: "X" })).toThrow();
  });
});

describe("softDeletePrestation", () => {
  beforeEach(() => makeService());

  it("archive la prestation", () => {
    softDeletePrestation(db, SERVICE_ID_1);
    const svc = getPrestation(db, SERVICE_ID_1);
    expect(svc?.archivedAt).toBeTypeOf("number");
  });

  it("lève une erreur si déjà archivée", () => {
    softDeletePrestation(db, SERVICE_ID_1);
    expect(() => softDeletePrestation(db, SERVICE_ID_1)).toThrow();
  });
});

describe("searchPrestations", () => {
  beforeEach(() => {
    createPrestation(db, { id: SERVICE_ID_1, workspaceId: WORKSPACE_ID, name: "Audit UX", unit: "forfait", unitPriceCents: 90000 });
    createPrestation(db, { id: SVC_2, workspaceId: WORKSPACE_ID, name: "Formation React", unit: "heure", unitPriceCents: 15000 });
  });

  it("filtre par nom", () => {
    const r = searchPrestations(db, WORKSPACE_ID, "audit");
    expect(r).toHaveLength(1);
    expect(r[0]?.name).toBe("Audit UX");
  });

  it("retourne vide si aucun résultat", () => {
    expect(searchPrestations(db, WORKSPACE_ID, "Z404")).toHaveLength(0);
  });
});
