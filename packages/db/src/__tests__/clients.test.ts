import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedWorkspace, seedClient, WORKSPACE_ID, CLIENT_ID_1, CLIENT_ID_2 } from "./helpers.js";
import {
  listClients,
  getClient,
  createClient,
  updateClient,
  softDeleteClient,
  searchClients,
} from "../queries/clients.js";
import type { TestDb } from "./helpers.js";

let db: TestDb;

beforeEach(() => {
  ({ db } = createTestDb());
  seedWorkspace(db);
});

describe("createClient", () => {
  it("crée un client et le retourne typé", () => {
    const client = createClient(db, {
      id: CLIENT_ID_1,
      workspaceId: WORKSPACE_ID,
      name: "CASA MIA",
      email: "claire@casamia.fr",
    });
    expect(client.id).toBe(CLIENT_ID_1);
    expect(client.name).toBe("CASA MIA");
    expect(client.workspaceId).toBe(WORKSPACE_ID);
    expect(client.archivedAt).toBeNull();
    expect(client.createdAt).toBeTypeOf("number");
  });

  it("accepte des champs optionnels null", () => {
    const client = createClient(db, {
      id: CLIENT_ID_1,
      workspaceId: WORKSPACE_ID,
      name: "Minimal",
    });
    expect(client.email).toBeNull();
    expect(client.siret).toBeNull();
  });

  it("gère firstCollaboration non-null", () => {
    const collab = Date.now();
    const client = createClient(db, {
      id: CLIENT_ID_1,
      workspaceId: WORKSPACE_ID,
      name: "Avec Date",
      firstCollaboration: collab,
    });
    expect(client.firstCollaboration).toBeTypeOf("number");
  });

  it("updateClient avec firstCollaboration null", () => {
    createClient(db, { id: CLIENT_ID_1, workspaceId: WORKSPACE_ID, name: "X", firstCollaboration: Date.now() });
    const updated = updateClient(db, CLIENT_ID_1, { firstCollaboration: null });
    expect(updated.firstCollaboration).toBeNull();
  });
});

describe("getClient", () => {
  it("retourne le client par ID", () => {
    createClient(db, { id: CLIENT_ID_1, workspaceId: WORKSPACE_ID, name: "A" });
    const found = getClient(db, CLIENT_ID_1);
    expect(found).not.toBeNull();
    expect(found?.name).toBe("A");
  });

  it("retourne null pour un ID inexistant", () => {
    expect(getClient(db, "non-existant")).toBeNull();
  });
});

describe("listClients", () => {
  beforeEach(() => {
    seedClient(db, { id: CLIENT_ID_1, email: "a@test.fr" });
    seedClient(db, { id: CLIENT_ID_2, email: "b@test.fr" });
  });

  it("liste les clients actifs du workspace", () => {
    const results = listClients(db, { workspaceId: WORKSPACE_ID });
    expect(results).toHaveLength(2);
  });

  it("exclut les clients archivés par défaut", () => {
    softDeleteClient(db, CLIENT_ID_1);
    const results = listClients(db, { workspaceId: WORKSPACE_ID });
    expect(results).toHaveLength(1);
  });

  it("inclut les archivés si demandé", () => {
    softDeleteClient(db, CLIENT_ID_1);
    const results = listClients(db, { workspaceId: WORKSPACE_ID, includeSoftDeleted: true });
    expect(results).toHaveLength(2);
  });

  it("filtre par recherche textuelle", () => {
    createClient(db, {
      id: "00000000-0000-0000-0000-000000000099",
      workspaceId: WORKSPACE_ID,
      name: "Maison Berthe",
      email: "berthe@test.fr",
    });
    const results = listClients(db, { workspaceId: WORKSPACE_ID, search: "Maison" });
    expect(results.some((c) => c.name === "Maison Berthe")).toBe(true);
  });

  it("respecte la pagination", () => {
    const p1 = listClients(db, { workspaceId: WORKSPACE_ID, limit: 1, offset: 0 });
    const p2 = listClients(db, { workspaceId: WORKSPACE_ID, limit: 1, offset: 1 });
    expect(p1).toHaveLength(1);
    expect(p2).toHaveLength(1);
    expect(p1[0]?.id).not.toBe(p2[0]?.id);
  });
});

describe("updateClient", () => {
  beforeEach(() => seedClient(db));

  it("met à jour les champs fournis", () => {
    const updated = updateClient(db, CLIENT_ID_1, { name: "Nouveau Nom", note: "VIP" });
    expect(updated.name).toBe("Nouveau Nom");
    expect(updated.note).toBe("VIP");
  });

  it("lève une erreur pour un client inexistant", () => {
    expect(() => updateClient(db, "bad-id", { name: "X" })).toThrow();
  });
});

describe("softDeleteClient", () => {
  beforeEach(() => seedClient(db));

  it("archive le client (archived_at non null)", () => {
    softDeleteClient(db, CLIENT_ID_1);
    const client = getClient(db, CLIENT_ID_1);
    expect(client?.archivedAt).toBeTypeOf("number");
    expect(client!.archivedAt).toBeGreaterThan(0);
  });

  it("lève une erreur si déjà archivé", () => {
    softDeleteClient(db, CLIENT_ID_1);
    expect(() => softDeleteClient(db, CLIENT_ID_1)).toThrow();
  });

  it("lève une erreur pour un ID inexistant", () => {
    expect(() => softDeleteClient(db, "bad-id")).toThrow();
  });
});

describe("searchClients", () => {
  beforeEach(() => {
    createClient(db, { id: CLIENT_ID_1, workspaceId: WORKSPACE_ID, name: "CASA MIA", email: "casa@test.fr" });
    createClient(db, { id: CLIENT_ID_2, workspaceId: WORKSPACE_ID, name: "Maison Berthe", email: "berthe@test.fr" });
  });

  it("retourne les clients correspondant à la recherche", () => {
    const r = searchClients(db, WORKSPACE_ID, "casa");
    expect(r).toHaveLength(1);
    expect(r[0]?.name).toBe("CASA MIA");
  });

  it("retourne tableau vide si aucun résultat", () => {
    expect(searchClients(db, WORKSPACE_ID, "XYZ404")).toHaveLength(0);
  });
});
