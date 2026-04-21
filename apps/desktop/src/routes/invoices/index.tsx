import type { ReactElement } from "react";
import { Routes, Route } from "react-router";
import { InvoicesListRoute } from "./List.js";
import { InvoiceNewRoute } from "./New.js";
import { InvoiceDetailRoute } from "./Detail.js";
import { InvoiceEditRoute } from "./Edit.js";

export function InvoicesRouter(): ReactElement {
  return (
    <Routes>
      <Route index element={<InvoicesListRoute />} />
      <Route path="new" element={<InvoiceNewRoute />} />
      <Route path=":id" element={<InvoiceDetailRoute />} />
      <Route path=":id/edit" element={<InvoiceEditRoute />} />
    </Routes>
  );
}
