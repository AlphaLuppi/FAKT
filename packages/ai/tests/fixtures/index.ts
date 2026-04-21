/**
 * Fixture index for MockAiProvider.
 * Imported dynamically by the mock provider — keeps test data out of prod bundle.
 */

import extractQuoteFixture from "./extract_quote.json";
import draftEmailFixture from "./draft_email.json";

export const FIXTURES: Record<string, unknown> = {
  extract_quote: extractQuoteFixture,
  draft_email: draftEmailFixture,
};
