import { tokens } from "@fakt/design-tokens";
import { fr } from "@fakt/shared";
import type { DocumentUnit, UUID } from "@fakt/shared";
import { Button } from "@fakt/ui";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { quotesApi } from "../../features/doc-editor/quotes-api.js";
import { QuoteForm, type QuoteFormValues } from "./QuoteForm.js";

function newId(): UUID {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `tmp-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export function NewManual(): ReactElement {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const duplicateOf = searchParams.get("duplicateOf");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [initial, setInitial] = useState<Partial<QuoteFormValues> | undefined>(undefined);

  useEffect(() => {
    if (!duplicateOf) return;
    let cancelled = false;
    quotesApi
      .get(duplicateOf)
      .then((src) => {
        if (!src || cancelled) return;
        // Duplication : on copie tout sauf numéro/dates/statut — user repart en draft.
        setInitial({
          clientId: src.clientId,
          title: src.title,
          notes: src.notes ?? "",
          items: src.items.map((it) => ({
            // UUID v4 neuf : l'item dupliqué doit avoir son propre id (Zod backend).
            id: newId(),
            position: it.position,
            description: it.description,
            quantity: it.quantity,
            unitPriceCents: it.unitPriceCents,
            unit: it.unit,
            lineTotalCents: it.lineTotalCents,
            serviceId: it.serviceId,
          })),
        });
      })
      .catch(() => {
        /* silencieux : duplication best-effort */
      });
    return (): void => {
      cancelled = true;
    };
  }, [duplicateOf]);

  async function handleSubmit(values: QuoteFormValues, issueNumber: boolean): Promise<void> {
    // Guard synchrone double-submit (cohérent avec Recap.tsx / IdentityTab).
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const items = values.items.map((item) => ({
        id: item.id.startsWith("tmp-") || item.id.startsWith("item-") ? newId() : item.id,
        position: item.position,
        description: item.description,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        unit: item.unit as DocumentUnit,
        lineTotalCents: item.lineTotalCents,
        serviceId: item.serviceId,
      }));

      if (!values.clientId) {
        throw new Error(fr.quotes.errors.missingClient);
      }

      const totalHt = items.reduce((s, i) => s + i.lineTotalCents, 0);
      const created = await quotesApi.create({
        clientId: values.clientId,
        title: values.title.trim(),
        conditions: null,
        clauses: values.clauses,
        validityDate: values.validityDate,
        notes: values.notes.trim().length > 0 ? values.notes : null,
        totalHtCents: totalHt,
        items,
        issueNumber,
      });
      void navigate(`/quotes/${created.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : fr.quotes.errors.createFailed);
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
            {fr.quotes.new}
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
            {fr.quotes.modes.manual}
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => void navigate("/quotes")}
          data-testid="quote-new-manual-back"
        >
          {fr.quotes.actions.backToList}
        </Button>
      </header>

      <QuoteForm
        initial={initial}
        onSubmit={handleSubmit}
        onCancel={() => void navigate("/quotes")}
        submitting={submitting}
        submitError={submitError}
      />
    </div>
  );
}
