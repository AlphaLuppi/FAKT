import type { ReactElement } from "react";
import { Route, Routes } from "react-router";
import { InvoiceDetailRoute } from "./Detail.js";
import { InvoiceEditRoute } from "./Edit.js";
import { InvoicesListRoute } from "./List.js";
import { InvoiceNewRoute } from "./New.js";

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
