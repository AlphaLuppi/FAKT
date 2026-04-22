import type { ReactElement } from "react";
import { useSearchParams } from "react-router";
import { NewAi } from "./NewAi.js";
import { NewManual } from "./NewManual.js";

/** Route aiguilleur — délègue à NewManual ou NewAi selon ?mode=. */
export function QuoteNewRoute(): ReactElement {
  const [params] = useSearchParams();
  const mode = params.get("mode") === "ai" ? "ai" : "manual";
  return mode === "ai" ? <NewAi /> : <NewManual />;
}
