import { tokens } from "@fakt/design-tokens";
import { buildLegalMentionsSnapshot } from "@fakt/legal";
import { fr } from "@fakt/shared";
import type { DocumentUnit, UUID } from "@fakt/shared";
import { Button } from "@fakt/ui";
import type { ReactElement } from "react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { invalidateSearchIndex } from "../../components/command-palette/useCommandPaletteIndex.js";
import { InvoiceForm, type InvoiceFormValues } from "../../features/doc-editor/index.js";
import { invoiceApi } from "../../features/doc-editor/invoice-api.js";
import { useClientsList, usePrestationsList, useWorkspace } from "../quotes/hooks.js";

function newId(): UUID {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `tmp-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export function NewScratch(): ReactElement {
  const navigate = useNavigate();
  const { clients } = useClientsList();
  const { prestations } = usePrestationsList();
  const { workspace } = useWorkspace();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(values: InvoiceFormValues, issueNumber: boolean): Promise<void> {
    if (!values.clientId) {
      setSubmitError(fr.invoices.errors.missingClient);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const items = values.items.map((item, idx) => ({
        id: item.id.startsWith("tmp-") || item.id.startsWith("item-") ? newId() : item.id,
        position: idx,
        description: item.description,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        unit: item.unit as DocumentUnit,
        lineTotalCents: item.lineTotalCents,
        serviceId: item.serviceId,
      }));

      const totalHtCents = items.reduce((s, i) => s + i.lineTotalCents, 0);

      const legalMentions = workspace
        ? buildLegalMentionsSnapshot(
            {
              name: workspace.name,
              legalForm: workspace.legalForm,
              siret: workspace.siret,
              address: workspace.address,
              iban: workspace.iban,
              tvaMention: workspace.tvaMention,
            },
            30
          )
        : "";

      const created = await invoiceApi.create({
        clientId: values.clientId,
        kind: "independent",
        title: values.title.trim(),
        totalHtCents,
        dueDate: values.dueDate,
        paymentMethod: values.paymentMethod,
        legalMentions,
        items,
        issueNumber,
      });
      invalidateSearchIndex();
      void navigate(`/invoices/${created.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : fr.invoices.errors.createFailed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        padding: tokens.spacing[6],
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacing[5],
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: tokens.spacing[4],
        }}
      >
        <div>
          <h1
            style={{
              font: `var(--w-black) var(--t-2xl)/1 ${tokens.font.ui}`,
              letterSpacing: "-0.02em",
              textTransform: "uppercase",
              color: tokens.color.ink,
              margin: 0,
            }}
          >
            {fr.invoices.new}
          </h1>
          <p
            style={{
              fontFamily: tokens.font.ui,
              fontSize: tokens.fontSize.sm,
              color: tokens.color.muted,
              marginTop: tokens.spacing[1],
              marginBottom: 0,
            }}
          >
            {fr.invoices.modes.fromScratch}
          </p>
        </div>
        <Button variant="ghost" onClick={() => void navigate("/invoices")}>
          {fr.invoices.actions.backToList}
        </Button>
      </header>

      <InvoiceForm
        onSubmit={handleSubmit}
        onCancel={() => void navigate("/invoices")}
        submitting={submitting}
        submitError={submitError}
        kind="scratch"
        clients={clients}
        prestations={prestations}
      />
    </div>
  );
}
