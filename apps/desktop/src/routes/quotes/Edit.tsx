import { tokens } from "@fakt/design-tokens";
import { fr } from "@fakt/shared";
import { Button } from "@fakt/ui";
import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { quotesApi } from "../../features/doc-editor/quotes-api.js";
import { QuoteForm, type QuoteFormValues, quoteToFormValues } from "./QuoteForm.js";
import { useQuote } from "./hooks.js";

export function QuoteEditRoute(): ReactElement {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const id = params.id;
  const { quote, loading, error } = useQuote(id);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const initial = useMemo<Partial<QuoteFormValues> | undefined>(
    () => (quote ? quoteToFormValues(quote) : undefined),
    [quote]
  );

  // Guard : redirige si non-draft.
  useEffect(() => {
    if (quote && quote.status !== "draft") {
      void navigate(`/quotes/${quote.id}`);
    }
  }, [quote, navigate]);

  async function handleSubmit(values: QuoteFormValues, _issueNumber: boolean): Promise<void> {
    // Guard synchrone double-submit.
    if (submitting) return;
    if (!id) return;
    if (!values.clientId) {
      setSubmitError(fr.quotes.errors.missingClient);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await quotesApi.update(id, {
        clientId: values.clientId,
        title: values.title.trim(),
        validityDate: values.validityDate,
        notes: values.notes.trim().length > 0 ? values.notes : null,
        totalHtCents: values.items.reduce((s, i) => s + i.lineTotalCents, 0),
        items: values.items.map((i) => ({
          id: i.id,
          position: i.position,
          description: i.description,
          quantity: i.quantity,
          unitPriceCents: i.unitPriceCents,
          unit: i.unit,
          lineTotalCents: i.lineTotalCents,
          serviceId: i.serviceId,
        })),
      });
      void navigate(`/quotes/${id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : fr.quotes.errors.saveFailed);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div style={{ padding: tokens.spacing[6] }}>Chargement…</div>;
  }

  if (error || !quote) {
    return (
      <div style={{ padding: tokens.spacing[6] }} data-testid="edit-not-found">
        {fr.quotes.errors.notFound}
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
          {fr.quotes.actions.edit}
        </h1>
        <Button
          variant="ghost"
          onClick={() => void navigate(`/quotes/${quote.id}`)}
          data-testid="quote-edit-cancel"
        >
          {fr.quotes.actions.cancel}
        </Button>
      </header>

      <QuoteForm
        initial={initial}
        onSubmit={handleSubmit}
        onCancel={() => void navigate(`/quotes/${quote.id}`)}
        submitting={submitting}
        submitError={submitError}
        editMode
      />
    </div>
  );
}
