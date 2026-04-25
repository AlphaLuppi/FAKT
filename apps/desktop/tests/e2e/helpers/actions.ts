/**
 * Helpers d'actions UI réutilisables pour les specs E2E.
 *
 * Les selectors privilégient `data-testid` (stables, garantis par
 * `docs/testing-conventions.md`) plutôt que les rôles ARIA + labels regex
 * fragiles. Pour la navigation et les CTAs sans testid disponible, on
 * fallback sur le rôle ARIA ou l'URL directe.
 */

import type { Page } from "@playwright/test";

export async function fillIdentityStep(
  page: Page,
  data: {
    name: string;
    siret: string;
    address: string;
    email: string;
    phone?: string;
    iban?: string;
  }
): Promise<void> {
  await page.getByTestId("wizard-identity-name").fill(data.name);
  await page.getByTestId("wizard-identity-siret").fill(data.siret);
  await page.getByTestId("wizard-identity-address").fill(data.address);
  await page.getByTestId("wizard-identity-email").fill(data.email);
  if (data.phone) await page.getByTestId("wizard-identity-phone").fill(data.phone);
  if (data.iban) await page.getByTestId("wizard-identity-iban").fill(data.iban);
}

export async function clickNext(page: Page): Promise<void> {
  // wizard-next existe sur Identity / ClaudeCli / Certificate. Sur Recap, le
  // CTA terminal est wizard-finish — on essaie next d'abord, fallback finish.
  const next = page.getByTestId("wizard-next").first();
  if (await next.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await next.click();
    return;
  }
  await page.getByTestId("wizard-finish").click();
}

export async function clickPrev(page: Page): Promise<void> {
  await page.getByTestId("wizard-prev").first().click();
}

export async function navigateTo(
  page: Page,
  destination: "dashboard" | "quotes" | "invoices" | "clients" | "services" | "archive" | "settings"
): Promise<void> {
  // Sidebar testids : sidebar-link-{id} pour dashboard/quotes/invoices/clients/services/archive,
  // sidebar-link-settings pour les réglages.
  const link = page.getByTestId(`sidebar-link-${destination}`);
  if (await link.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await link.click();
    return;
  }
  // Fallback navigation directe via URL (mêmes routes que React Router).
  const paths: Record<typeof destination, string> = {
    dashboard: "/",
    quotes: "/quotes",
    invoices: "/invoices",
    clients: "/clients",
    services: "/services",
    archive: "/archive",
    settings: "/settings",
  };
  await page.goto(paths[destination]);
}

export async function fillClientForm(
  page: Page,
  data: {
    name: string;
    email?: string;
    addressLine1?: string;
    zip?: string;
    city?: string;
    taxIdNumber?: string;
  }
): Promise<void> {
  await page.getByTestId("client-form-name").fill(data.name);
  if (data.email) await page.getByTestId("client-form-email").fill(data.email);
  if (data.addressLine1) await page.getByTestId("client-form-address").fill(data.addressLine1);
  // Pas de testid dédié zip/ville/n° TVA dans ClientForm.tsx (champs absents
  // du formulaire actuel) — on fallback sur les labels accessibles tant que
  // ces champs ne sont pas exposés via testids.
  if (data.zip) await page.getByLabel(/code postal/i).fill(data.zip);
  if (data.city) await page.getByLabel(/^ville$/i).fill(data.city);
  if (data.taxIdNumber) await page.getByLabel(/n° tva|tva intra/i).fill(data.taxIdNumber);
}

export async function submitForm(
  page: Page,
  label: RegExp = /(enregistrer|créer|sauvegarder|valider)/i
): Promise<void> {
  // Quand on connaît le contexte (client form notamment), préférer le testid
  // dédié — sinon fallback sur le rôle/label visible. Les appelants existants
  // peuvent passer une regex spécifique si besoin.
  const clientSubmit = page.getByTestId("client-form-submit");
  if (await clientSubmit.isVisible({ timeout: 500 }).catch(() => false)) {
    await clientSubmit.click();
    return;
  }
  await page.getByRole("button", { name: label }).first().click();
}
