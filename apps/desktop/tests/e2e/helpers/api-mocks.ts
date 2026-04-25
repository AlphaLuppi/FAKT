/**
 * Mocks Playwright pour le sidecar Bun (Hono + Drizzle).
 *
 * Pourquoi mocker plutôt que lancer le sidecar : les tests E2E dev mode
 * doivent être déterministes, rapides (< 5s) et tournables sans installer
 * Postgres ni compiler le binaire Rust. Tous les endpoints `/api/*` sont
 * interceptés via `page.route` et répondent depuis un store en mémoire muté
 * par les handlers.
 *
 * Le shape de chaque réponse suit `@fakt/shared` (cf. `domain.ts`) et le
 * format de réponse du sidecar Hono (cf. `packages/api-server/src/routes/*`).
 * Une divergence ici fait échouer les tests silencieusement parce que l'UI
 * ne sait pas afficher un objet partiellement typé.
 *
 * Pour les tests release mode (binaire packagé), c'est `wdio.conf.ts` qui
 * prend le relais avec un vrai sidecar + DB SQLite éphémère.
 */

import type { Client, Invoice, Quote, Service, Workspace } from "@fakt/shared";
import type { Page, Route } from "@playwright/test";
import {
  FIXTURE_CLIENTS,
  FIXTURE_INVOICES,
  FIXTURE_QUOTES,
  FIXTURE_SERVICES,
  FIXTURE_WORKSPACE,
  genUuid,
} from "./fixtures.js";

export interface MockState {
  workspace: Workspace | null;
  clients: Client[];
  services: Service[];
  quotes: Quote[];
  invoices: Invoice[];
  numbering: { quoteSeq: number; invoiceSeq: number; year: number };
  settings: Record<string, string>;
  auth: { authenticated: boolean };
}

export type MockMode = "empty" | "seeded";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createMockState(mode: MockMode = "seeded"): MockState {
  if (mode === "empty") {
    return {
      workspace: null,
      clients: [],
      services: [],
      quotes: [],
      invoices: [],
      numbering: { quoteSeq: 0, invoiceSeq: 0, year: 2026 },
      settings: {},
      auth: { authenticated: false },
    };
  }
  return {
    workspace: clone(FIXTURE_WORKSPACE),
    clients: FIXTURE_CLIENTS.map(clone),
    services: FIXTURE_SERVICES.map(clone),
    quotes: FIXTURE_QUOTES.map(clone),
    invoices: FIXTURE_INVOICES.map(clone),
    numbering: { quoteSeq: 2, invoiceSeq: 1, year: 2026 },
    settings: {},
    // En mode 1 (sidecar local) l'auth est bypassée par le frontend, donc
    // peu importe la valeur. En mode 2 (remote) on commence non authentifié
    // pour permettre au flow login de s'afficher correctement.
    auth: { authenticated: false },
  };
}

function json(route: Route, status: number, body: unknown): Promise<void> {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function notFound(route: Route, message = "Resource not found"): Promise<void> {
  return json(route, 404, { error: { code: "NOT_FOUND", message } });
}

function readBody(route: Route): Record<string, unknown> | null {
  const data = route.request().postData();
  if (!data) return null;
  try {
    const parsed = JSON.parse(data);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

function nextQuoteNumber(state: MockState): { number: string; year: number; sequence: number } {
  state.numbering.quoteSeq += 1;
  return {
    number: `D${state.numbering.year}-${pad3(state.numbering.quoteSeq)}`,
    year: state.numbering.year,
    sequence: state.numbering.quoteSeq,
  };
}

function nextInvoiceNumber(state: MockState): { number: string; year: number; sequence: number } {
  state.numbering.invoiceSeq += 1;
  return {
    number: `F${state.numbering.year}-${pad3(state.numbering.invoiceSeq)}`,
    year: state.numbering.year,
    sequence: state.numbering.invoiceSeq,
  };
}

function paginate<T>(
  items: T[],
  query: URLSearchParams
): { items: T[]; pagination: { limit: number; offset: number; count: number } } {
  const limit = Number.parseInt(query.get("limit") ?? "100", 10);
  const offset = Number.parseInt(query.get("offset") ?? "0", 10);
  const sliced = items.slice(offset, offset + limit);
  return { items: sliced, pagination: { limit, offset, count: sliced.length } };
}

function isSoftDeletedFiltered(query: URLSearchParams): boolean {
  const v = query.get("includeSoftDeleted");
  if (v === null) return true; // par défaut côté client : exclus
  return v !== "true" && v !== "1";
}

/**
 * Installe les mocks API sur une page Playwright. À appeler avant `page.goto`.
 */
export async function installApiMocks(page: Page, state: MockState): Promise<MockState> {
  // Predicate au lieu de regex pour éviter de matcher les imports Vite ESM
  // (`/src/api/render.ts` est servi par Vite en dev mode et ne doit PAS être
  // intercepté, sinon le boot React crash en 404 sur ses propres modules).
  await page.route(
    (url) => url.pathname.startsWith("/api/") || url.pathname === "/api",
    async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      const path = url.pathname.replace(/^\/api/, "");
      const query = url.searchParams;

      // ────────────────────────────── HEALTH ──────────────────────────────
      if (path === "/health") return json(route, 200, { ok: true });

      // ────────────────────────────── WORKSPACE ──────────────────────────
      if (path === "/workspace" && method === "GET") {
        if (!state.workspace) return notFound(route, "workspace non initialisé");
        return json(route, 200, state.workspace);
      }
      if (path === "/workspace" && method === "POST") {
        if (state.workspace) {
          return json(route, 409, {
            error: { code: "CONFLICT", message: "workspace déjà initialisé" },
          });
        }
        const body = (readBody(route) ?? {}) as Partial<Workspace> & { id?: string };
        const ws: Workspace = {
          id: body.id ?? genUuid(),
          name: String(body.name ?? FIXTURE_WORKSPACE.name),
          legalForm: (body.legalForm as Workspace["legalForm"]) ?? "Micro-entreprise",
          siret: String(body.siret ?? ""),
          address: String(body.address ?? ""),
          email: String(body.email ?? ""),
          iban: body.iban ?? null,
          tvaMention: String(body.tvaMention ?? FIXTURE_WORKSPACE.tvaMention),
          createdAt: Date.now(),
        };
        state.workspace = ws;
        return json(route, 201, ws);
      }
      if (path === "/workspace" && method === "PATCH") {
        if (!state.workspace) return notFound(route, "workspace non initialisé");
        const body = (readBody(route) ?? {}) as Partial<Workspace>;
        state.workspace = { ...state.workspace, ...body };
        return json(route, 200, state.workspace);
      }

      // ────────────────────────────── CLIENTS ────────────────────────────
      if (path === "/clients" && method === "GET") {
        let items = state.clients;
        if (isSoftDeletedFiltered(query)) {
          items = items.filter((c) => c.archivedAt === null);
        }
        const search = query.get("search");
        if (search) {
          const s = search.toLowerCase();
          items = items.filter(
            (c) =>
              c.name.toLowerCase().includes(s) ||
              (c.email?.toLowerCase().includes(s) ?? false) ||
              (c.contactName?.toLowerCase().includes(s) ?? false)
          );
        }
        return json(route, 200, paginate(items, query));
      }
      if (path === "/clients/search" && method === "GET") {
        const q = (query.get("q") ?? "").toLowerCase();
        const items = state.clients.filter(
          (c) =>
            c.archivedAt === null &&
            (c.name.toLowerCase().includes(q) || (c.email?.toLowerCase().includes(q) ?? false))
        );
        return json(route, 200, { items });
      }
      if (path === "/clients" && method === "POST") {
        const body = (readBody(route) ?? {}) as Partial<Client> & { id?: string };
        const cli: Client = {
          id: body.id ?? genUuid(),
          workspaceId: state.workspace?.id ?? FIXTURE_WORKSPACE.id,
          name: String(body.name ?? "Sans nom"),
          legalForm: body.legalForm ?? null,
          siret: body.siret ?? null,
          address: body.address ?? null,
          contactName: body.contactName ?? null,
          email: body.email ?? null,
          sector: body.sector ?? null,
          firstCollaboration: body.firstCollaboration ?? null,
          note: body.note ?? null,
          archivedAt: null,
          createdAt: Date.now(),
        };
        state.clients.push(cli);
        return json(route, 201, cli);
      }
      const cliRestoreMatch = path.match(/^\/clients\/([^/]+)\/restore$/);
      if (cliRestoreMatch && method === "POST") {
        const idx = state.clients.findIndex((c) => c.id === cliRestoreMatch[1]);
        if (idx === -1) return notFound(route);
        state.clients[idx] = { ...state.clients[idx], archivedAt: null };
        return json(route, 200, state.clients[idx]);
      }
      const cliMatch = path.match(/^\/clients\/([^/]+)$/);
      if (cliMatch) {
        const id = cliMatch[1];
        const idx = state.clients.findIndex((c) => c.id === id);
        if (idx === -1) return notFound(route);
        if (method === "GET") return json(route, 200, state.clients[idx]);
        if (method === "PATCH") {
          const body = (readBody(route) ?? {}) as Partial<Client>;
          state.clients[idx] = { ...state.clients[idx], ...body, id: state.clients[idx].id };
          return json(route, 200, state.clients[idx]);
        }
        if (method === "DELETE") {
          // Soft delete
          state.clients[idx] = { ...state.clients[idx], archivedAt: Date.now() };
          return json(route, 204, {});
        }
      }

      // ────────────────────────────── SERVICES ───────────────────────────
      if (path === "/services" && method === "GET") {
        let items = state.services;
        if (isSoftDeletedFiltered(query)) {
          items = items.filter((s) => s.archivedAt === null);
        }
        return json(route, 200, paginate(items, query));
      }
      if (path === "/services/search" && method === "GET") {
        const q = (query.get("q") ?? "").toLowerCase();
        const items = state.services.filter(
          (s) => s.archivedAt === null && s.name.toLowerCase().includes(q)
        );
        return json(route, 200, { items });
      }
      if (path === "/services" && method === "POST") {
        const body = (readBody(route) ?? {}) as Partial<Service> & { id?: string };
        const srv: Service = {
          id: body.id ?? genUuid(),
          workspaceId: state.workspace?.id ?? FIXTURE_WORKSPACE.id,
          name: String(body.name ?? "Service"),
          description: body.description ?? null,
          unit: (body.unit as Service["unit"]) ?? "unité",
          unitPriceCents: Number(body.unitPriceCents ?? 0),
          tags: body.tags ?? null,
          archivedAt: null,
          createdAt: Date.now(),
        };
        state.services.push(srv);
        return json(route, 201, srv);
      }
      const srvRestoreMatch = path.match(/^\/services\/([^/]+)\/restore$/);
      if (srvRestoreMatch && method === "POST") {
        const idx = state.services.findIndex((s) => s.id === srvRestoreMatch[1]);
        if (idx === -1) return notFound(route);
        state.services[idx] = { ...state.services[idx], archivedAt: null };
        return json(route, 200, state.services[idx]);
      }
      const srvMatch = path.match(/^\/services\/([^/]+)$/);
      if (srvMatch) {
        const id = srvMatch[1];
        const idx = state.services.findIndex((s) => s.id === id);
        if (idx === -1) return notFound(route);
        if (method === "GET") return json(route, 200, state.services[idx]);
        if (method === "PATCH") {
          const body = (readBody(route) ?? {}) as Partial<Service>;
          state.services[idx] = { ...state.services[idx], ...body, id: state.services[idx].id };
          return json(route, 200, state.services[idx]);
        }
        if (method === "DELETE") {
          state.services[idx] = { ...state.services[idx], archivedAt: Date.now() };
          return json(route, 204, {});
        }
      }

      // ────────────────────────────── QUOTES ─────────────────────────────
      if (path === "/quotes" && method === "GET") {
        let items = state.quotes;
        if (isSoftDeletedFiltered(query)) {
          items = items.filter((q) => q.archivedAt === null);
        }
        return json(route, 200, paginate(items, query));
      }
      if (path === "/quotes/search" && method === "GET") {
        const q = (query.get("q") ?? "").toLowerCase();
        const items = state.quotes.filter(
          (qu) =>
            qu.archivedAt === null &&
            ((qu.number?.toLowerCase().includes(q) ?? false) || qu.title.toLowerCase().includes(q))
        );
        return json(route, 200, { items });
      }
      if (path === "/quotes" && method === "POST") {
        const body = (readBody(route) ?? {}) as Partial<Quote> & {
          id?: string;
          items?: Array<Partial<Quote["items"][number]>>;
        };
        const items = (body.items ?? []).map((it, i) => ({
          id: it.id ?? genUuid(),
          position: it.position ?? i,
          description: String(it.description ?? ""),
          quantity: Number(it.quantity ?? 0),
          unitPriceCents: Number(it.unitPriceCents ?? 0),
          unit: (it.unit as Quote["items"][number]["unit"]) ?? "unité",
          lineTotalCents: Math.round(
            (Number(it.quantity ?? 0) * Number(it.unitPriceCents ?? 0)) / 1000
          ),
          serviceId: it.serviceId ?? null,
        }));
        const totalHtCents = items.reduce((s, it) => s + it.lineTotalCents, 0);
        const quote: Quote = {
          id: body.id ?? genUuid(),
          workspaceId: state.workspace?.id ?? FIXTURE_WORKSPACE.id,
          clientId: String(body.clientId ?? ""),
          number: null,
          year: null,
          sequence: null,
          title: String(body.title ?? "Devis"),
          status: "draft",
          totalHtCents,
          conditions: body.conditions ?? null,
          validityDate: body.validityDate ?? null,
          notes: body.notes ?? null,
          issuedAt: null,
          signedAt: null,
          archivedAt: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          items,
        };
        state.quotes.push(quote);
        return json(route, 201, quote);
      }
      const quoteIssueMatch = path.match(/^\/quotes\/([^/]+)\/issue$/);
      if (quoteIssueMatch && method === "POST") {
        const idx = state.quotes.findIndex((q) => q.id === quoteIssueMatch[1]);
        if (idx === -1) return notFound(route);
        const num = nextQuoteNumber(state);
        state.quotes[idx] = {
          ...state.quotes[idx],
          ...num,
          status: "sent",
          issuedAt: Date.now(),
          updatedAt: Date.now(),
        };
        return json(route, 200, state.quotes[idx]);
      }
      const quoteTransitions: Record<string, Quote["status"]> = {
        "mark-sent": "sent",
        "unmark-sent": "draft",
        expire: "expired",
        cancel: "refused",
        "mark-signed": "signed",
        "mark-invoiced": "invoiced",
      };
      for (const [action, status] of Object.entries(quoteTransitions)) {
        const m = path.match(new RegExp(`^/quotes/([^/]+)/${action}$`));
        if (m && method === "POST") {
          const idx = state.quotes.findIndex((q) => q.id === m[1]);
          if (idx === -1) return notFound(route);
          const patch: Partial<Quote> = { status, updatedAt: Date.now() };
          if (status === "signed") patch.signedAt = Date.now();
          state.quotes[idx] = { ...state.quotes[idx], ...patch };
          return json(route, 200, state.quotes[idx]);
        }
      }
      const quotePreviewMatch = path.match(/^\/quotes\/([^/]+)\/preview-next-number$/);
      if (quotePreviewMatch && method === "GET") {
        return json(route, 200, {
          number: `D${state.numbering.year}-${pad3(state.numbering.quoteSeq + 1)}`,
          year: state.numbering.year,
          sequence: state.numbering.quoteSeq + 1,
        });
      }
      const quoteMatch = path.match(/^\/quotes\/([^/]+)$/);
      if (quoteMatch) {
        const id = quoteMatch[1];
        const idx = state.quotes.findIndex((q) => q.id === id);
        if (idx === -1) return notFound(route);
        if (method === "GET") return json(route, 200, state.quotes[idx]);
        if (method === "PATCH") {
          const body = (readBody(route) ?? {}) as Partial<Quote>;
          state.quotes[idx] = {
            ...state.quotes[idx],
            ...body,
            id: state.quotes[idx].id,
            updatedAt: Date.now(),
          };
          return json(route, 200, state.quotes[idx]);
        }
        if (method === "DELETE") {
          state.quotes[idx] = { ...state.quotes[idx], archivedAt: Date.now() };
          return json(route, 204, {});
        }
      }

      // ────────────────────────────── INVOICES ───────────────────────────
      if (path === "/invoices" && method === "GET") {
        let items = state.invoices;
        if (isSoftDeletedFiltered(query)) {
          items = items.filter((i) => i.archivedAt === null);
        }
        return json(route, 200, paginate(items, query));
      }
      if (path === "/invoices/search" && method === "GET") {
        const q = (query.get("q") ?? "").toLowerCase();
        const items = state.invoices.filter(
          (inv) =>
            inv.archivedAt === null &&
            ((inv.number?.toLowerCase().includes(q) ?? false) ||
              inv.title.toLowerCase().includes(q))
        );
        return json(route, 200, { items });
      }
      if (path === "/invoices" && method === "POST") {
        const body = (readBody(route) ?? {}) as Partial<Invoice> & {
          id?: string;
          items?: Array<Partial<Invoice["items"][number]>>;
        };
        const items = (body.items ?? []).map((it, i) => ({
          id: it.id ?? genUuid(),
          position: it.position ?? i,
          description: String(it.description ?? ""),
          quantity: Number(it.quantity ?? 0),
          unitPriceCents: Number(it.unitPriceCents ?? 0),
          unit: (it.unit as Invoice["items"][number]["unit"]) ?? "unité",
          lineTotalCents: Math.round(
            (Number(it.quantity ?? 0) * Number(it.unitPriceCents ?? 0)) / 1000
          ),
          serviceId: it.serviceId ?? null,
        }));
        const totalHtCents = items.reduce((s, it) => s + it.lineTotalCents, 0);
        const invoice: Invoice = {
          id: body.id ?? genUuid(),
          workspaceId: state.workspace?.id ?? FIXTURE_WORKSPACE.id,
          clientId: String(body.clientId ?? ""),
          quoteId: body.quoteId ?? null,
          number: null,
          year: null,
          sequence: null,
          kind: body.kind ?? "independent",
          depositPercent: body.depositPercent ?? null,
          title: String(body.title ?? "Facture"),
          status: "draft",
          totalHtCents,
          dueDate: body.dueDate ?? null,
          paidAt: null,
          paymentMethod: body.paymentMethod ?? null,
          paymentNotes: body.paymentNotes ?? null,
          legalMentions: String(body.legalMentions ?? FIXTURE_WORKSPACE.tvaMention),
          issuedAt: null,
          archivedAt: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          items,
        };
        state.invoices.push(invoice);
        return json(route, 201, invoice);
      }
      const invoiceFromQuoteMatch = path.match(/^\/invoices\/from-quote\/([^/]+)$/);
      if (invoiceFromQuoteMatch && method === "POST") {
        const quoteId = invoiceFromQuoteMatch[1];
        const quote = state.quotes.find((q) => q.id === quoteId);
        if (!quote) return notFound(route, "devis introuvable");
        const body = (readBody(route) ?? {}) as Partial<Invoice>;
        const num = nextInvoiceNumber(state);
        const invoice: Invoice = {
          id: genUuid(),
          workspaceId: quote.workspaceId,
          clientId: quote.clientId,
          quoteId: quote.id,
          ...num,
          kind: body.kind ?? "independent",
          depositPercent: body.depositPercent ?? null,
          title: body.title ?? quote.title,
          status: "sent",
          totalHtCents: quote.totalHtCents,
          dueDate: body.dueDate ?? null,
          paidAt: null,
          paymentMethod: body.paymentMethod ?? null,
          paymentNotes: body.paymentNotes ?? null,
          legalMentions: String(body.legalMentions ?? FIXTURE_WORKSPACE.tvaMention),
          issuedAt: Date.now(),
          archivedAt: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          items: quote.items.map((it) => ({ ...it, id: genUuid() })),
        };
        state.invoices.push(invoice);
        return json(route, 201, invoice);
      }
      const invoiceIssueMatch = path.match(/^\/invoices\/([^/]+)\/issue$/);
      if (invoiceIssueMatch && method === "POST") {
        const idx = state.invoices.findIndex((i) => i.id === invoiceIssueMatch[1]);
        if (idx === -1) return notFound(route);
        const num = nextInvoiceNumber(state);
        state.invoices[idx] = {
          ...state.invoices[idx],
          ...num,
          status: "sent",
          issuedAt: Date.now(),
          updatedAt: Date.now(),
        };
        return json(route, 200, state.invoices[idx]);
      }
      const invoiceMarkPaidMatch = path.match(/^\/invoices\/([^/]+)\/mark-paid$/);
      if (invoiceMarkPaidMatch && method === "POST") {
        const idx = state.invoices.findIndex((i) => i.id === invoiceMarkPaidMatch[1]);
        if (idx === -1) return notFound(route);
        const body = (readBody(route) ?? {}) as Partial<Invoice>;
        state.invoices[idx] = {
          ...state.invoices[idx],
          status: "paid",
          paidAt: body.paidAt ?? Date.now(),
          paymentMethod: body.paymentMethod ?? state.invoices[idx].paymentMethod,
          paymentNotes: body.paymentNotes ?? state.invoices[idx].paymentNotes,
          updatedAt: Date.now(),
        };
        return json(route, 200, state.invoices[idx]);
      }
      const invoiceTransitions: Record<string, Invoice["status"]> = {
        "mark-sent": "sent",
        "mark-overdue": "overdue",
        cancel: "cancelled",
      };
      for (const [action, status] of Object.entries(invoiceTransitions)) {
        const m = path.match(new RegExp(`^/invoices/([^/]+)/${action}$`));
        if (m && method === "POST") {
          const idx = state.invoices.findIndex((i) => i.id === m[1]);
          if (idx === -1) return notFound(route);
          state.invoices[idx] = { ...state.invoices[idx], status, updatedAt: Date.now() };
          return json(route, 200, state.invoices[idx]);
        }
      }
      const invoiceArchiveMatch = path.match(/^\/invoices\/([^/]+)\/archive$/);
      if (invoiceArchiveMatch && method === "POST") {
        const idx = state.invoices.findIndex((i) => i.id === invoiceArchiveMatch[1]);
        if (idx === -1) return notFound(route);
        state.invoices[idx] = { ...state.invoices[idx], archivedAt: Date.now() };
        return json(route, 200, state.invoices[idx]);
      }
      const invoiceMatch = path.match(/^\/invoices\/([^/]+)$/);
      if (invoiceMatch) {
        const id = invoiceMatch[1];
        const idx = state.invoices.findIndex((i) => i.id === id);
        if (idx === -1) return notFound(route);
        if (method === "GET") return json(route, 200, state.invoices[idx]);
        if (method === "PATCH") {
          const body = (readBody(route) ?? {}) as Partial<Invoice>;
          state.invoices[idx] = {
            ...state.invoices[idx],
            ...body,
            id: state.invoices[idx].id,
            updatedAt: Date.now(),
          };
          return json(route, 200, state.invoices[idx]);
        }
        if (method === "DELETE") {
          state.invoices[idx] = { ...state.invoices[idx], archivedAt: Date.now() };
          return json(route, 204, {});
        }
      }

      // ────────────────────────────── ACTIVITY ───────────────────────────
      if (path === "/activity" && method === "GET") {
        const events: unknown[] = [
          ...state.quotes.map((q) => ({
            id: `act-q-${q.id}`,
            workspaceId: q.workspaceId,
            type: q.signedAt ? "signed" : "created",
            entityType: "quote",
            entityId: q.id,
            payload: { number: q.number },
            createdAt: q.signedAt ?? q.createdAt,
          })),
          ...state.invoices.map((i) => ({
            id: `act-i-${i.id}`,
            workspaceId: i.workspaceId,
            type: i.paidAt ? "paid" : "created",
            entityType: "invoice",
            entityId: i.id,
            payload: { number: i.number },
            createdAt: i.paidAt ?? i.createdAt,
          })),
        ];
        return json(route, 200, { items: events });
      }

      // ────────────────────────────── SEARCH ─────────────────────────────
      if (path === "/search" && method === "GET") {
        const q = (query.get("q") ?? "").toLowerCase();
        const hits = [
          ...state.clients
            .filter((c) => c.archivedAt === null && c.name.toLowerCase().includes(q))
            .map((c) => ({ kind: "client" as const, id: c.id, label: c.name })),
          ...state.quotes
            .filter((qu) => qu.archivedAt === null && (qu.number ?? "").toLowerCase().includes(q))
            .map((qu) => ({ kind: "quote" as const, id: qu.id, label: qu.number ?? qu.title })),
          ...state.invoices
            .filter(
              (inv) => inv.archivedAt === null && (inv.number ?? "").toLowerCase().includes(q)
            )
            .map((inv) => ({
              kind: "invoice" as const,
              id: inv.id,
              label: inv.number ?? inv.title,
            })),
        ];
        return json(route, 200, { hits });
      }

      // ────────────────────────────── NUMBERING ──────────────────────────
      if (path === "/numbering" && method === "GET") {
        return json(route, 200, {
          items: [
            {
              workspaceId: state.workspace?.id,
              year: state.numbering.year,
              type: "quote",
              lastSequence: state.numbering.quoteSeq,
            },
            {
              workspaceId: state.workspace?.id,
              year: state.numbering.year,
              type: "invoice",
              lastSequence: state.numbering.invoiceSeq,
            },
          ],
        });
      }

      // ────────────────────────────── SETTINGS ───────────────────────────
      if (path === "/settings" && method === "GET") {
        const items = Object.entries(state.settings).map(([key, value]) => ({ key, value }));
        return json(route, 200, { items });
      }
      const settingMatch = path.match(/^\/settings\/(.+)$/);
      if (settingMatch) {
        const key = decodeURIComponent(settingMatch[1]);
        if (method === "GET") {
          if (state.settings[key] === undefined) return notFound(route);
          return json(route, 200, { key, value: state.settings[key] });
        }
        if (method === "PUT") {
          const body = (readBody(route) ?? {}) as { value?: string };
          state.settings[key] = body.value ?? "";
          return json(route, 200, { key, value: state.settings[key] });
        }
      }

      // ────────────────────────────── SIGNATURES ─────────────────────────
      if (path === "/signature-events" && method === "GET") {
        return json(route, 200, { events: [] });
      }
      if (path === "/signature-events" && method === "POST") {
        const body = (readBody(route) ?? {}) as {
          documentType?: "quote" | "invoice";
          documentId?: string;
        };
        if (body.documentType === "quote" && body.documentId) {
          const idx = state.quotes.findIndex((q) => q.id === body.documentId);
          if (idx !== -1) {
            state.quotes[idx] = { ...state.quotes[idx], signedAt: Date.now(), status: "signed" };
          }
        }
        return json(route, 200, { id: genUuid(), timestamp: Date.now() });
      }
      if (path === "/signature-events/verify" && method === "GET") {
        return json(route, 200, { valid: true, chain: [] });
      }
      const signedDocMatch = path.match(/^\/signed-documents\/([^/]+)\/([^/]+)$/);
      if (signedDocMatch && method === "GET") {
        return json(route, 200, { exists: false });
      }
      if (path === "/signed-documents" && method === "POST") {
        return json(route, 201, { id: genUuid() });
      }

      // ────────────────────────────── BACKUPS ────────────────────────────
      if (path === "/backups" && method === "GET") {
        return json(route, 200, { items: [] });
      }

      // ────────────────────────────── RENDER ─────────────────────────────
      if (path.startsWith("/render") && method === "POST") {
        if (path === "/render/email-draft") {
          return json(route, 200, {
            emlPath: "/tmp/mock-draft.eml",
            mailto: "mailto:client@example.com",
          });
        }
        const pdfBytes = new TextEncoder().encode("%PDF-1.4\n%mock\n");
        return route.fulfill({ status: 200, contentType: "application/pdf", body: pdfBytes });
      }

      // ────────────────────────────── AUTH (mode 2) ──────────────────────
      // Auth API — shape exact de `LoginResponse` / `MeResponse` cf.
      // `apps/desktop/src/api/auth.ts`. Toute divergence fait crasher useAuth
      // au login (lecture user.fullName etc.) et l'app affiche `login-error`.
      if (path === "/auth/login" && method === "POST") {
        const body = readBody(route) as { email?: string; password?: string } | null;
        const valid = body?.email === "user@example.com" && body?.password === "password123";
        if (valid) {
          state.auth.authenticated = true;
          return json(route, 200, {
            user: {
              id: "u-001",
              email: body.email,
              fullName: "Test User",
              avatarUrl: null,
            },
            workspaces: [state.workspace?.id ?? FIXTURE_WORKSPACE.id],
            accessToken: "mock-access-token",
            refreshToken: "mock-refresh-token",
          });
        }
        return json(route, 401, {
          error: { code: "UNAUTHORIZED", message: "Email ou mot de passe invalide" },
        });
      }
      if (path === "/auth/logout" && method === "POST") {
        state.auth.authenticated = false;
        return json(route, 200, { ok: true });
      }
      if (path === "/auth/refresh" && method === "POST") {
        if (!state.auth.authenticated) {
          return json(route, 401, { error: { code: "UNAUTHORIZED", message: "Non authentifié" } });
        }
        return json(route, 200, {
          accessToken: "mock-access-token-refreshed",
          workspaces: [state.workspace?.id ?? FIXTURE_WORKSPACE.id],
        });
      }
      if (path === "/auth/me" && method === "GET") {
        if (!state.auth.authenticated) {
          return json(route, 401, { error: { code: "UNAUTHORIZED", message: "Non authentifié" } });
        }
        return json(route, 200, {
          user: {
            id: "u-001",
            email: "user@example.com",
            fullName: "Test User",
            avatarUrl: null,
          },
          workspaces: [
            {
              workspaceId: state.workspace?.id ?? FIXTURE_WORKSPACE.id,
              role: "owner",
            },
          ],
        });
      }

      return notFound(route, `unmocked route: ${method} ${path}`);
    }
  );

  return state;
}

/**
 * Injecte les variables globales que le bootstrap React attend de Tauri.
 * Sans ça, l'app croit tourner en mode "non initialisé" et bloque sur splash.
 * À appeler via `page.addInitScript` AVANT `page.goto`.
 */
export async function injectFaktGlobals(
  page: Page,
  opts: { mode?: 1 | 2; apiUrl?: string; token?: string } = {}
): Promise<void> {
  const mode = opts.mode ?? 1;
  const apiUrl = opts.apiUrl ?? "http://127.0.0.1:65000";
  const token = opts.token ?? "mock-token";
  await page.addInitScript(
    ({ apiUrl, token, mode }) => {
      const w = window as unknown as {
        __FAKT_API_URL__?: string;
        __FAKT_API_TOKEN__?: string;
        __FAKT_MODE__?: number;
      };
      w.__FAKT_API_URL__ = apiUrl;
      w.__FAKT_API_TOKEN__ = token;
      w.__FAKT_MODE__ = mode;
    },
    { apiUrl, token, mode }
  );
}
