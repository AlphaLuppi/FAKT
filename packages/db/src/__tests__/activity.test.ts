import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedWorkspace, WORKSPACE_ID } from "./helpers.js";
import { listActivity, insertActivity } from "../queries/activity.js";
import type { TestDb } from "./helpers.js";

let db: TestDb;

const EV_ID_1 = "aaaaaaaa-0000-4000-8000-000000000001";
const EV_ID_2 = "aaaaaaaa-0000-4000-8000-000000000002";
const EV_ID_3 = "aaaaaaaa-0000-4000-8000-000000000003";
const ENTITY_A = "bbbbbbbb-0000-4000-8000-000000000001";
const ENTITY_B = "bbbbbbbb-0000-4000-8000-000000000002";

beforeEach(() => {
  ({ db } = createTestDb());
  seedWorkspace(db);
});

describe("insertActivity", () => {
  it("insère un event et le retourne avec createdAt", () => {
    const ev = insertActivity(db, {
      id: EV_ID_1,
      workspaceId: WORKSPACE_ID,
      type: "email.drafted",
      entityType: "invoice",
      entityId: ENTITY_A,
      payload: JSON.stringify({ to: "a@b.fr" }),
    });
    expect(ev.id).toBe(EV_ID_1);
    expect(ev.type).toBe("email.drafted");
    expect(ev.payload).toContain("a@b.fr");
    expect(ev.createdAt).toBeGreaterThan(0);
  });

  it("accepte entityType/entityId/payload null", () => {
    const ev = insertActivity(db, {
      id: EV_ID_1,
      workspaceId: WORKSPACE_ID,
      type: "workspace.updated",
    });
    expect(ev.entityType).toBeNull();
    expect(ev.entityId).toBeNull();
    expect(ev.payload).toBeNull();
  });
});

describe("listActivity", () => {
  beforeEach(() => {
    insertActivity(db, {
      id: EV_ID_1,
      workspaceId: WORKSPACE_ID,
      type: "email.drafted",
      entityType: "invoice",
      entityId: ENTITY_A,
    });
    insertActivity(db, {
      id: EV_ID_2,
      workspaceId: WORKSPACE_ID,
      type: "client.created",
      entityType: "client",
      entityId: ENTITY_B,
    });
    insertActivity(db, {
      id: EV_ID_3,
      workspaceId: WORKSPACE_ID,
      type: "email.drafted",
      entityType: "invoice",
      entityId: ENTITY_B,
    });
  });

  it("liste tous les events pour le workspace", () => {
    const all = listActivity(db, { workspaceId: WORKSPACE_ID });
    expect(all).toHaveLength(3);
  });

  it("filtre par entityType", () => {
    const res = listActivity(db, { workspaceId: WORKSPACE_ID, entityType: "client" });
    expect(res).toHaveLength(1);
    expect(res[0]?.type).toBe("client.created");
  });

  it("filtre par entityId", () => {
    const res = listActivity(db, { workspaceId: WORKSPACE_ID, entityId: ENTITY_A });
    expect(res).toHaveLength(1);
  });

  it("filtre par type", () => {
    const res = listActivity(db, { workspaceId: WORKSPACE_ID, type: "email.drafted" });
    expect(res).toHaveLength(2);
  });

  it("pagination limit/offset", () => {
    const first = listActivity(db, { workspaceId: WORKSPACE_ID, limit: 2, offset: 0 });
    const second = listActivity(db, { workspaceId: WORKSPACE_ID, limit: 2, offset: 2 });
    expect(first).toHaveLength(2);
    expect(second).toHaveLength(1);
  });
});
