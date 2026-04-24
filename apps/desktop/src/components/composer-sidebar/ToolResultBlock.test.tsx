/**
 * Tests ToolResultBlock - carte repliable avec badge OK/ERREUR.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToolResultBlock } from "./ToolResultBlock.js";

describe("ToolResultBlock", () => {
  it("rend badge OK quand isError=false", () => {
    render(<ToolResultBlock content='{"status":"ok"}' isError={false} />);
    expect(screen.getByTestId("tool-result-badge")).toHaveTextContent("OK");
  });

  it("rend badge ERREUR quand isError=true", () => {
    render(<ToolResultBlock content="oops" isError />);
    expect(screen.getByTestId("tool-result-badge")).toHaveTextContent("ERREUR");
  });

  it("ouvre le contenu au clic", () => {
    render(<ToolResultBlock content="retour brut" isError={false} />);
    fireEvent.click(screen.getByTestId("tool-result-toggle"));
    expect(screen.getByText("retour brut")).toBeInTheDocument();
  });
});
