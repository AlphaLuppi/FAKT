import { tokens } from "@fakt/design-tokens";
import { fr } from "@fakt/shared";
import type { DocumentUnit } from "@fakt/shared";
import { Button } from "@fakt/ui";
import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  InvoiceForm,
  type InvoiceFormValues,
  invoiceToFormValues,
} from "../../features/doc-editor/index.js";
import { invoiceApi } from "../../features/doc-editor/invoice-api.js";
import { useClientsList, usePrestationsList } from "../quotes/hooks.js";
import { useInvoice } from "./hooks.js";

export function InvoiceEditRoute(): ReactElement {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const id = params.id;
  const { invoice, loading, error } = useInvoice(id);
  const { clients } = useClientsList();
  const { prestations } = usePrestationsList();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const initial = useMemo<Partial<InvoiceFormValues> | undefined>(
    () => (invoice ? invoiceToFormValues(invoice) : undefined),
    [invoice]
  );

  // Guard : redirige si non-draft.
  useEffect(() => {
    if (invoice && invoice.status !== "draft") {
      void navigate(`/invoices/${invoice.id}`);
    }
  }, [invoice, navigate]);

  async function handleSubmit(values: InvoiceFormValues): Promise<void> {
    if (!id) return;
    if (!values.clientId) {
      setSubmitError(fr.invoices.errors.missingClient);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await invoiceApi.update(id, {
        clientId: values.clientId,
        title: values.title.trim(),
        dueDate: values.dueDate,
        paymentMethod: values.paymentMethod,
        totalHtCents: values.items.reduce((s, i) => s + i.lineTotalCents, 0),
        items: values.items.map((item, idx) => ({
          id: item.id,
          position: idx,
          description: item.description,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          unit: item.unit as DocumentUnit,
          lineTotalCents: item.lineTotalCents,
          serviceId: item.serviceId,
        })),
      });
      void navigate(`/invoices/${id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : fr.invoices.errors.saveFailed);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div style={{ padding: tokens.spacing[6] }}>Chargement…</div>;
  }

  if (error || !invoice) {
    return (
      <div style={{ padding: tokens.spacing[6] }} data-testid="invoice-edit-not-found">
        {fr.invoices.errors.notFound}
      </div>
    );
  }

  if (invoice.status !== "draft") {
    return (
      <div
        data-testid="invoice-edit-blocked"
        style={{
          padding: tokens.spacing[6],
          display: "flex",
          flexDirection: "column",
          gap: tokens.spacing[4],
          maxWidth: 720,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            border: `${tokens.stroke.bold} solid ${tokens.color.ink}`,
            background: tokens.color.dangerBg,
            padding: tokens.spacing[5],
            fontFamily: tokens.font.ui,
            fontWeight: Number(tokens.fontWeight.bold),
          }}
        >
          {fr.invoices.detail.issuedNotEditable}
        </div>
        <div style={{ display: "flex", gap: tokens.spacing[3] }}>
          <Button variant="ghost" onClick={() => void navigate(`/invoices/${invoice.id}`)}>
            {fr.invoices.actions.backToList}
          </Button>
          <Button
            variant="secondary"
            disabled
            data-testid="invoice-edit-credit-note-stub"
            title={fr.invoices.detail.creditNoteTodo}
          >
            {fr.invoices.actions.createCreditNote}
          </Button>
        </div>
      </div>
    );
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
        }}
      >
        <h1
          style={{
            font: `var(--w-black) var(--t-2xl)/1 ${tokens.font.ui}`,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            color: tokens.color.ink,
            margin: 0,
          }}
        >
          {fr.invoices.actions.edit}
        </h1>
        <Button variant="ghost" onClick={() => void navigate(`/invoices/${invoice.id}`)}>
          {fr.invoices.actions.cancel}
        </Button>
      </header>

      <InvoiceForm
        initial={initial}
        onSubmit={handleSubmit}
        onCancel={() => void navigate(`/invoices/${invoice.id}`)}
        submitting={submitting}
        submitError={submitError}
        editMode
        clients={clients}
        prestations={prestations}
      />
    </div>
  );
}
