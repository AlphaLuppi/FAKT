import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Toaster, toast } from "../feedback/Toast.js";

describe("Toaster", () => {
  it("rend sans erreur et expose toast depuis sonner", async () => {
    await act(async () => {
      render(<Toaster />);
    });
    // Sonner rend ses éléments via React sous le composant ;
    // on vérifie au minimum l'absence d'erreur et l'API exportée.
    expect(typeof toast).toBe("function");
    expect(typeof toast.success).toBe("function");
    expect(typeof toast.error).toBe("function");
  });
});
