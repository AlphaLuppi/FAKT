import { describe, expect, it } from "vitest";

import {
  CLAUSE_BY_ID,
  CLAUSE_CATALOG,
  clausesByCategory,
  hydrateClauses,
  parseClauses,
  serializeClauses,
  toggleClauseWithExclusions,
} from "../clauses.js";

describe("CLAUSE_CATALOG", () => {
  it("contient au moins une clause par catégorie attendue", () => {
    const cats = new Set(CLAUSE_CATALOG.map((c) => c.category));
    expect(cats).toContain("payment");
    expect(cats).toContain("warranty");
    expect(cats).toContain("ip");
    expect(cats).toContain("liability");
    expect(cats).toContain("jurisdiction");
  });

  it("a des IDs uniques et stables", () => {
    const ids = CLAUSE_CATALOG.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("référence des excludes valides (qui pointent sur des IDs existants)", () => {
    for (const c of CLAUSE_CATALOG) {
      if (!c.excludes) continue;
      for (const ex of c.excludes) {
        expect(CLAUSE_BY_ID.has(ex)).toBe(true);
      }
    }
  });

  it("a des body non vides en français", () => {
    for (const c of CLAUSE_CATALOG) {
      expect(c.body.length).toBeGreaterThan(20);
      expect(c.label.length).toBeGreaterThan(3);
    }
  });
});

describe("toggleClauseWithExclusions", () => {
  it("ajoute un ID inexistant dans la sélection", () => {
    const next = toggleClauseWithExclusions([], "deposit-30");
    expect(next).toEqual(["deposit-30"]);
  });

  it("retire un ID déjà présent", () => {
    const next = toggleClauseWithExclusions(["deposit-30", "warranty-12"], "deposit-30");
    expect(next).not.toContain("deposit-30");
    expect(next).toContain("warranty-12");
  });

  it("retire automatiquement les exclusions mutuelles", () => {
    const next = toggleClauseWithExclusions(["deposit-30"], "deposit-50");
    expect(next).toContain("deposit-50");
    expect(next).not.toContain("deposit-30");
  });

  it("ne touche pas aux clauses sans relation d'exclusion", () => {
    const next = toggleClauseWithExclusions(
      ["deposit-30", "warranty-6", "ip-transfer"],
      "liability-cap"
    );
    expect(next).toEqual(
      expect.arrayContaining(["deposit-30", "warranty-6", "ip-transfer", "liability-cap"])
    );
  });

  it("warranty-12 décoche warranty-6 et inversement", () => {
    let next = toggleClauseWithExclusions(["warranty-6"], "warranty-12");
    expect(next).toEqual(["warranty-12"]);
    next = toggleClauseWithExclusions(next, "warranty-6");
    expect(next).toEqual(["warranty-6"]);
  });

  it("ip-license décoche ip-transfer et inversement", () => {
    const next = toggleClauseWithExclusions(["ip-transfer"], "ip-license");
    expect(next).toContain("ip-license");
    expect(next).not.toContain("ip-transfer");
  });
});

describe("hydrateClauses", () => {
  it("retourne les définitions correspondantes pour des IDs valides", () => {
    const defs = hydrateClauses(["deposit-30", "warranty-12"]);
    expect(defs).toHaveLength(2);
    expect(defs[0]?.id).toBe("deposit-30");
    expect(defs[1]?.id).toBe("warranty-12");
  });

  it("ignore silencieusement les IDs inconnus", () => {
    const defs = hydrateClauses(["deposit-30", "obsolete-id-xyz"]);
    expect(defs).toHaveLength(1);
    expect(defs[0]?.id).toBe("deposit-30");
  });

  it("retourne un tableau vide pour une liste vide", () => {
    expect(hydrateClauses([])).toEqual([]);
  });
});

describe("clausesByCategory", () => {
  it("groupe le catalogue par categorie", () => {
    const groups = clausesByCategory();
    expect(groups.payment.length).toBeGreaterThan(0);
    expect(groups.warranty.length).toBeGreaterThan(0);
    expect(groups.ip.length).toBeGreaterThan(0);
    expect(groups.liability.length).toBeGreaterThan(0);
    expect(groups.jurisdiction.length).toBeGreaterThan(0);
  });

  it("a un total de clauses egal au catalogue", () => {
    const groups = clausesByCategory();
    const total = Object.values(groups).reduce((acc, arr) => acc + arr.length, 0);
    expect(total).toBe(CLAUSE_CATALOG.length);
  });
});

describe("serializeClauses / parseClauses (round-trip)", () => {
  it("serialise une liste non-vide en JSON", () => {
    expect(serializeClauses(["deposit-30", "warranty-12"])).toBe('["deposit-30","warranty-12"]');
  });

  it("retourne null pour une liste vide", () => {
    expect(serializeClauses([])).toBeNull();
  });

  it("parse un JSON valide vers la liste d'IDs", () => {
    expect(parseClauses('["deposit-30","warranty-12"]')).toEqual(["deposit-30", "warranty-12"]);
  });

  it("retourne tableau vide sur null/undefined/empty", () => {
    expect(parseClauses(null)).toEqual([]);
    expect(parseClauses("")).toEqual([]);
    expect(parseClauses("   ")).toEqual([]);
  });

  it("retourne tableau vide sur JSON invalide", () => {
    expect(parseClauses("{not json}")).toEqual([]);
    expect(parseClauses('"not an array"')).toEqual([]);
  });

  it("filtre les éléments non-string dans le tableau", () => {
    expect(parseClauses('["deposit-30",42,null,"warranty-12"]')).toEqual([
      "deposit-30",
      "warranty-12",
    ]);
  });

  it("round-trip d'une selection de clauses preserve l'identite", () => {
    const original = ["deposit-30", "warranty-12", "ip-transfer", "liability-cap"];
    const serialized = serializeClauses(original);
    expect(serialized).not.toBeNull();
    const parsed = parseClauses(serialized);
    expect(parsed).toEqual(original);
  });
});
