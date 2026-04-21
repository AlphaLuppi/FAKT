import type { ReactElement } from "react";
import { Routes, Route } from "react-router";
import { QuotesListRoute } from "./List.js";
import { QuoteNewRoute } from "./New.js";
import { QuoteDetailRoute } from "./Detail.js";
import { QuoteEditRoute } from "./Edit.js";

export function QuotesRouter(): ReactElement {
  return (
    <Routes>
      <Route index element={<QuotesListRoute />} />
      <Route path="new" element={<QuoteNewRoute />} />
      <Route path=":id" element={<QuoteDetailRoute />} />
      <Route path=":id/edit" element={<QuoteEditRoute />} />
    </Routes>
  );
}
