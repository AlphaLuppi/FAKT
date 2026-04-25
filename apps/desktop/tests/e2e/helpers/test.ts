/**
 * Fixture Playwright étendu — entrée par défaut des specs E2E dev mode.
 *
 * Au lieu d'importer `test` depuis `@playwright/test`, importer depuis ce
 * fichier : `import { test, expect } from "../helpers/test.js"`. Chaque test
 * reçoit alors un `mockState` initialisé en mode "seeded" et l'API sidecar
 * est déjà mockée. Pour partir d'un workspace vide (test onboarding) :
 *   `test.use({ mockMode: "empty" })`
 */

import { test as base, expect } from "@playwright/test";
import {
  type MockMode,
  type MockState,
  createMockState,
  injectFaktGlobals,
  installApiMocks,
} from "./api-mocks.js";

interface Fixtures {
  mockMode: MockMode;
  faktMode: 1 | 2;
  mockState: MockState;
}

export const test = base.extend<Fixtures>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture signature.
  mockMode: [async ({}, use) => use("seeded"), { option: true }],
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture signature.
  faktMode: [async ({}, use) => use(1), { option: true }],
  mockState: [
    async ({ page, mockMode, faktMode }, use) => {
      const state = createMockState(mockMode);
      await injectFaktGlobals(page, { mode: faktMode });
      await installApiMocks(page, state);
      await use(state);
    },
    // auto:true ⇒ le fixture s'exécute pour CHAQUE test, même quand il n'est
    // pas listé dans la destructuration du callback. Sans ça, les tests qui
    // ne demandent que { page } voient l'app fetch la vraie URL (fallback
    // hardcodé http://127.0.0.1:8765 dans client.ts) et reçoivent CORS errors.
    { auto: true },
  ],
});

export { expect };
