import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedWorkspace } from "./helpers.js";
import { listBackups, insertBackup, deleteBackup } from "../queries/backups.js";
import type { TestDb } from "./helpers.js";

let db: TestDb;

const ID_1 = "bbbb0000-0000-4000-8000-000000000001";
const ID_2 = "bbbb0000-0000-4000-8000-000000000002";

beforeEach(() => {
  ({ db } = createTestDb());
  seedWorkspace(db);
});

describe("insertBackup", () => {
  it("crée un enregistrement", () => {
    const b = insertBackup(db, { id: ID_1, path: "/tmp/1.zip", sizeBytes: 1024 });
    expect(b.id).toBe(ID_1);
    expect(b.sizeBytes).toBe(1024);
    expect(b.createdAt).toBeGreaterThan(0);
  });
});

describe("listBackups", () => {
  beforeEach(() => {
    insertBackup(db, { id: ID_1, path: "/tmp/1.zip", sizeBytes: 1024 });
    insertBackup(db, { id: ID_2, path: "/tmp/2.zip", sizeBytes: 2048 });
  });

  it("liste desc createdAt", () => {
    const all = listBackups(db);
    expect(all).toHaveLength(2);
  });

  it("pagination limit", () => {
    const res = listBackups(db, { limit: 1 });
    expect(res).toHaveLength(1);
  });
});

describe("deleteBackup", () => {
  it("retire l'enregistrement", () => {
    insertBackup(db, { id: ID_1, path: "/tmp/1.zip", sizeBytes: 1024 });
    deleteBackup(db, ID_1);
    expect(listBackups(db)).toHaveLength(0);
  });

  it("throw si id inexistant", () => {
    expect(() => deleteBackup(db, "99999999-0000-4000-8000-999999999999")).toThrow(
      /not found/i
    );
  });
});
