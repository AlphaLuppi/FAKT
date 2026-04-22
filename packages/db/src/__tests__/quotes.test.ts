import { beforeEach, describe, expect, it } from "vitest";
import {
  createQuote,
  deleteQuote,
  getQuote,
  listQuotes,
  searchQuotes,
  updateQuote,
  updateQuoteStatus,
} from "../queries/quotes.js";
import { CLIENT_ID_1, WORKSPACE_ID, createTestDb, seedClient, seedWorkspace } from "./helpers.js";
import type { TestDb } from "./helpers.js";

let db: TestDb;

const QUOTE_ID = "10000000-0000-0000-0000-000000000001";
const QUOTE_ID_2 = "10000000-0000-0000-0000-000000000002";

const ITEM = {
  id: "20000000-0000-0000-0000-000000000001",
  position: 0,
  description: "Développement site",
  quantity: 1000,
  unitPriceCents: 70000,
  unit: "jour" as const,
  lineTotalCents: 70000,
  serviceId: null,
};

beforeEach(() => {
  ({ db } = createTestDb());
  seedWorkspace(db);
  seedClient(db);
});

describe("createQuote", () => {
  it("crée un devis avec ses lignes", () => {
    const q = createQuote(db, {
      id: QUOTE_ID,
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID_1,
      title: "Site vitrine CASA MIA",
      totalHtCents: 70000,
      items: [ITEM],
    });
    expect(q.id).toBe(QUOTE_ID);
    expect(q.status).toBe("draft");
    expect(q.items).toHaveLength(1);
    expect(q.items[0]?.description).toBe("Développement site");
  });

  it("retourne un devis sans items si tableau vide", () => {
    const q = createQuote(db, {
      id: QUOTE_ID,
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID_1,
      title: "Devis vide",
      totalHtCents: 0,
      items: [],
    });
    expect(q.items).toHaveLength(0);
  });
});

describe("getQuote", () => {
  beforeEach(() =>
    createQuote(db, {
      id: QUOTE_ID,
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID_1,
      title: "D",
      totalHtCents: 0,
      items: [],
    })
  );

  it("retourne le devis avec ses items", () => {
    expect(getQuote(db, QUOTE_ID)?.title).toBe("D");
  });

  it("retourne null pour un ID inexistant", () => {
    expect(getQuote(db, "non-existent")).toBeNull();
  });
});

describe("listQuotes", () => {
  beforeEach(() => {
    createQuote(db, {
      id: QUOTE_ID,
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID_1,
      title: "A",
      totalHtCents: 0,
      items: [],
    });
    createQuote(db, {
      id: QUOTE_ID_2,
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID_1,
      title: "B",
      totalHtCents: 0,
      items: [],
    });
  });

  it("liste les devis du workspace", () => {
    expect(listQuotes(db, { workspaceId: WORKSPACE_ID })).toHaveLength(2);
  });

  it("filtre par statut unique", () => {
    updateQuoteStatus(db, QUOTE_ID, "sent");
    const drafts = listQuotes(db, { workspaceId: WORKSPACE_ID, status: "draft" });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.id).toBe(QUOTE_ID_2);
  });

  it("filtre par plusieurs statuts (array)", () => {
    updateQuoteStatus(db, QUOTE_ID, "sent");
    const results = listQuotes(db, { workspaceId: WORKSPACE_ID, status: ["draft", "sent"] });
    expect(results).toHaveLength(2);
  });

  it("trie les items par position", () => {
    const ITEM_A = {
      id: "20000000-0000-0000-0000-000000000010",
      position: 1,
      description: "B",
      quantity: 1000,
      unitPriceCents: 10000,
      unit: "heure" as const,
      lineTotalCents: 10000,
      serviceId: null,
    };
    const ITEM_B = {
      id: "20000000-0000-0000-0000-000000000011",
      position: 0,
      description: "A",
      quantity: 1000,
      unitPriceCents: 10000,
      unit: "heure" as const,
      lineTotalCents: 10000,
      serviceId: null,
    };
    const QUOTE_MULTI = "10000000-0000-0000-0000-000000000099";
    createQuote(db, {
      id: QUOTE_MULTI,
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID_1,
      title: "Multi-items",
      totalHtCents: 20000,
      items: [ITEM_A, ITEM_B],
    });
    const q = getQuote(db, QUOTE_MULTI);
    expect(q?.items[0]?.position).toBe(0);
    expect(q?.items[1]?.position).toBe(1);
  });
});

describe("updateQuote", () => {
  beforeEach(() =>
    createQuote(db, {
      id: QUOTE_ID,
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID_1,
      title: "Old",
      totalHtCents: 0,
      items: [],
    })
  );

  it("met à jour le titre et les items", () => {
    const updated = updateQuote(db, QUOTE_ID, {
      title: "New Title",
      items: [ITEM],
    });
    expect(updated.title).toBe("New Title");
    expect(updated.items).toHaveLength(1);
  });

  it("lève une erreur pour un ID inexistant", () => {
    expect(() => updateQuote(db, "bad-id", { title: "X" })).toThrow();
  });
});

describe("deleteQuote", () => {
  it("supprime un draft", () => {
    createQuote(db, {
      id: QUOTE_ID,
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID_1,
      title: "D",
      totalHtCents: 0,
      items: [],
    });
    deleteQuote(db, QUOTE_ID);
    expect(getQuote(db, QUOTE_ID)).toBeNull();
  });

  it("interdit la suppression d'un devis non-draft", () => {
    createQuote(db, {
      id: QUOTE_ID,
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID_1,
      title: "D",
      totalHtCents: 0,
      items: [],
    });
    updateQuoteStatus(db, QUOTE_ID, "sent");
    expect(() => deleteQuote(db, QUOTE_ID)).toThrow(/draft only/);
  });

  it("lève une erreur pour un ID inexistant", () => {
    expect(() => deleteQuote(db, "bad-id")).toThrow();
  });
});

describe("updateQuoteStatus", () => {
  beforeEach(() =>
    createQuote(db, {
      id: QUOTE_ID,
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID_1,
      title: "D",
      totalHtCents: 0,
      items: [],
    })
  );

  it("transite draft → sent", () => {
    const q = updateQuoteStatus(db, QUOTE_ID, "sent");
    expect(q.status).toBe("sent");
    expect(q.issuedAt).toBeTypeOf("number");
  });

  it("transite sent → signed", () => {
    updateQuoteStatus(db, QUOTE_ID, "sent");
    const q = updateQuoteStatus(db, QUOTE_ID, "signed");
    expect(q.status).toBe("signed");
    expect(q.signedAt).toBeTypeOf("number");
  });

  it("refuse une transition invalide", () => {
    expect(() => updateQuoteStatus(db, QUOTE_ID, "signed")).toThrow(/invalid transition/);
  });

  it("transite signed → invoiced (cycle facturation)", () => {
    updateQuoteStatus(db, QUOTE_ID, "sent");
    updateQuoteStatus(db, QUOTE_ID, "signed");
    const q = updateQuoteStatus(db, QUOTE_ID, "invoiced");
    expect(q.status).toBe("invoiced");
  });

  it("interdit invoiced → tout autre statut (terminal)", () => {
    updateQuoteStatus(db, QUOTE_ID, "sent");
    updateQuoteStatus(db, QUOTE_ID, "signed");
    updateQuoteStatus(db, QUOTE_ID, "invoiced");
    expect(() => updateQuoteStatus(db, QUOTE_ID, "signed")).toThrow(/invalid transition/);
    expect(() => updateQuoteStatus(db, QUOTE_ID, "draft")).toThrow(/invalid transition/);
  });

  it("interdit signed → draft ou sent (pas de rollback)", () => {
    updateQuoteStatus(db, QUOTE_ID, "sent");
    updateQuoteStatus(db, QUOTE_ID, "signed");
    expect(() => updateQuoteStatus(db, QUOTE_ID, "draft")).toThrow(/invalid transition/);
    expect(() => updateQuoteStatus(db, QUOTE_ID, "sent")).toThrow(/invalid transition/);
  });

  it("lève une erreur pour un ID inexistant", () => {
    expect(() => updateQuoteStatus(db, "bad-id", "sent")).toThrow();
  });
});

describe("searchQuotes", () => {
  beforeEach(() => {
    createQuote(db, {
      id: QUOTE_ID,
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID_1,
      title: "Site vitrine Hotel",
      totalHtCents: 0,
      items: [],
    });
    createQuote(db, {
      id: QUOTE_ID_2,
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID_1,
      title: "Formation React",
      totalHtCents: 0,
      items: [],
    });
  });

  it("filtre par titre", () => {
    const r = searchQuotes(db, WORKSPACE_ID, "Hotel");
    expect(r).toHaveLength(1);
    expect(r[0]?.title).toBe("Site vitrine Hotel");
  });
});
