import type { ReactElement } from "react";
import { useSearchParams } from "react-router";
import { NewFromQuote } from "./NewFromQuote.js";
import { NewScratch } from "./NewScratch.js";

/** Route aiguilleur — délègue à NewFromQuote ou NewScratch selon ?from=. */
export function InvoiceNewRoute(): ReactElement {
  const [params] = useSearchParams();
  const from = params.get("from") === "scratch" ? "scratch" : "quote";
  return from === "scratch" ? <NewScratch /> : <NewFromQuote />;
}
