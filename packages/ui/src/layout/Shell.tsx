import { tokens } from "@fakt/design-tokens";
import type { ReactElement, ReactNode } from "react";

export interface ShellProps {
  sidebar: ReactNode;
  topbar?: ReactNode;
  children: ReactNode;
  "data-testid"?: string;
  testIdMain?: string;
}

/** Layout brutal : sidebar gauche + topbar + contenu scrollable. */
export function Shell({
  sidebar,
  topbar,
  children,
  "data-testid": testId,
  testIdMain,
}: ShellProps): ReactElement {
  return (
    <div
      data-testid={testId}
      style={{
        display: "flex",
        minHeight: "100vh",
        background: tokens.color.paper,
        color: tokens.color.ink,
        fontFamily: tokens.font.ui,
      }}
    >
      {sidebar}
      <main
        data-testid={testIdMain}
        style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}
      >
        {topbar}
        <div style={{ flex: 1, overflow: "auto" }}>{children}</div>
      </main>
    </div>
  );
}
