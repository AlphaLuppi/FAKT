/**
 * Fixture index for MockAiProvider.
 * Imported dynamically by the mock provider — keeps test data out of prod bundle.
 */

import draftEmailFixture from "./draft_email.json" with { type: "json" };
import extractQuoteFixture from "./extract_quote.json" with { type: "json" };

export const FIXTURES: Record<string, unknown> = {
  extract_quote: extractQuoteFixture,
  draft_email: draftEmailFixture,
};
