import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MarkPaidModal, type MarkPaidPayload } from "./MarkPaidModal.js";

describe("MarkPaidModal", () => {
  it("n'est pas rendu quand open=false", () => {
    const onConfirm = vi.fn(async () => {});
    const onClose = vi.fn();
    render(
      <MarkPaidModal
        open={false}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.queryByTestId("mark-paid-date")).not.toBeInTheDocument();
  });

  it("affiche date picker + méthode + notes", () => {
    render(
      <MarkPaidModal
        open={true}
        onClose={() => {}}
        onConfirm={async () => {}}
      />,
    );
    expect(screen.getByTestId("mark-paid-date")).toBeInTheDocument();
    expect(screen.getByTestId("mark-paid-method")).toBeInTheDocument();
    expect(screen.getByTestId("mark-paid-notes")).toBeInTheDocument();
    expect(screen.getByTestId("mark-paid-confirm")).toBeInTheDocument();
    expect(screen.getByTestId("mark-paid-cancel")).toBeInTheDocument();
  });

  it("affiche le champ custom method quand method=other", () => {
    render(
      <MarkPaidModal
        open={true}
        onClose={() => {}}
        onConfirm={async () => {}}
      />,
    );
    expect(screen.queryByTestId("mark-paid-custom")).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId("mark-paid-method"), {
      target: { value: "other" },
    });
    expect(screen.getByTestId("mark-paid-custom")).toBeInTheDocument();
  });

  it("soumet les bonnes valeurs : date, méthode wire, notes", async () => {
    const onConfirm = vi.fn(async () => {});
    render(
      <MarkPaidModal
        open={true}
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.change(screen.getByTestId("mark-paid-notes"), {
      target: { value: "Reçu le jour même" },
    });
    fireEvent.click(screen.getByTestId("mark-paid-confirm"));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
    const calls = onConfirm.mock.calls as unknown as Array<[MarkPaidPayload]>;
    const payload = calls[0]?.[0];
    if (!payload) throw new Error("onConfirm not called");
    expect(payload.method).toBe("wire");
    expect(payload.notes).toBe("Reçu le jour même");
    expect(payload.paidAt).toBeGreaterThan(0);
  });

  it("refuse une date future (validation Zod)", async () => {
    const onConfirm = vi.fn(async () => {});
    render(
      <MarkPaidModal
        open={true}
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    );
    const future = new Date(Date.now() + 10 * 24 * 3600 * 1000);
    const iso = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}-${String(future.getDate()).padStart(2, "0")}`;
    fireEvent.change(screen.getByTestId("mark-paid-date"), {
      target: { value: iso },
    });
    fireEvent.click(screen.getByTestId("mark-paid-confirm"));

    await waitFor(() => {
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  it("méthode 'other' sans custom method → bloqué par Zod", async () => {
    const onConfirm = vi.fn(async () => {});
    render(
      <MarkPaidModal
        open={true}
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.change(screen.getByTestId("mark-paid-method"), {
      target: { value: "other" },
    });
    fireEvent.click(screen.getByTestId("mark-paid-confirm"));

    await waitFor(() => {
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  it("méthode 'other' avec custom method → passe et préfixe notes", async () => {
    const onConfirm = vi.fn(async () => {});
    render(
      <MarkPaidModal
        open={true}
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.change(screen.getByTestId("mark-paid-method"), {
      target: { value: "other" },
    });
    fireEvent.change(screen.getByTestId("mark-paid-custom"), {
      target: { value: "Lydia" },
    });
    fireEvent.change(screen.getByTestId("mark-paid-notes"), {
      target: { value: "Contact client" },
    });
    fireEvent.click(screen.getByTestId("mark-paid-confirm"));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
    const calls = onConfirm.mock.calls as unknown as Array<[MarkPaidPayload]>;
    const payload = calls[0]?.[0];
    if (!payload) throw new Error("onConfirm not called");
    expect(payload.method).toBe("other");
    expect(payload.notes).toBe("Lydia — Contact client");
  });

  it("affiche l'erreur serveur transmise via prop", () => {
    render(
      <MarkPaidModal
        open={true}
        onClose={() => {}}
        onConfirm={async () => {}}
        error="Erreur serveur"
      />,
    );
    expect(screen.getByTestId("mark-paid-error")).toHaveTextContent(
      "Erreur serveur",
    );
  });

  it("désactive le bouton confirm quand submitting=true", () => {
    render(
      <MarkPaidModal
        open={true}
        onClose={() => {}}
        onConfirm={async () => {}}
        submitting={true}
      />,
    );
    expect(screen.getByTestId("mark-paid-cancel")).toBeDisabled();
  });
});
