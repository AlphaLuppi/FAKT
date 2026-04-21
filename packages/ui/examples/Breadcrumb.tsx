import type { ReactElement } from "react";
import { Breadcrumb } from "../src/data-display/Breadcrumb.js";

export function BreadcrumbExample(): ReactElement {
  return (
    <div style={{ padding: 24 }}>
      <Breadcrumb
        items={[
          { label: "Devis", onClick: () => {} },
          { label: "D2026-042", onClick: () => {} },
          { label: "Détail", current: true },
        ]}
      />
    </div>
  );
}
