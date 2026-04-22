import type { ReactElement } from "react";
import { Route, Routes } from "react-router";
import { QuoteDetailRoute } from "./Detail.js";
import { QuoteEditRoute } from "./Edit.js";
import { QuotesListRoute } from "./List.js";
import { QuoteNewRoute } from "./New.js";

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
