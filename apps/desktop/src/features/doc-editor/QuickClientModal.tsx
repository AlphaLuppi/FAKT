/**
 * Modale de création rapide d'un client depuis l'éditeur de devis/facture.
 * Champs minimaux (nom + email + SIRET). Les champs complémentaires restent
 * éditables depuis la page Clients — évite de casser le flow devis.
 */

import { normalizeSiret, validateSiret } from "@fakt/legal";
import { fr } from "@fakt/shared";
import type { Client } from "@fakt/shared";
import { Button, Input, Modal } from "@fakt/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "../../api/index.js";

const quickSchema = z.object({
  name: z.string().min(1, "Le nom est obligatoire").max(200),
  email: z.string().email("Email invalide").or(z.literal("")).optional(),
  siret: z
    .string()
    .optional()
    .refine((val) => {
      if (!val || val.trim() === "") return true;
      return validateSiret(normalizeSiret(val));
    }, fr.errors.siretInvalid),
});

type QuickClientValues = z.infer<typeof quickSchema>;

export interface QuickClientModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (client: Client) => void;
}

function genUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function QuickClientModal({
  open,
  onClose,
  onCreated,
}: QuickClientModalProps): ReactElement {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<QuickClientValues>({
    resolver: zodResolver(quickSchema),
    defaultValues: { name: "", email: "", siret: "" },
  });

  useEffect(() => {
    if (open) {
      reset({ name: "", email: "", siret: "" });
      setSubmitError(null);
    }
  }, [open, reset]);

  const handleFormSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const created = await api.clients.create({
        id: genUuid(),
        name: values.name.trim(),
        email: values.email && values.email.trim() !== "" ? values.email.trim() : null,
        siret: values.siret && values.siret.trim() !== "" ? normalizeSiret(values.siret) : null,
      });
      onCreated(created);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={fr.quotes.form.clientQuickNew}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            {fr.quotes.actions.cancel}
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="quick-client-form"
            disabled={isSubmitting}
            data-testid="quick-client-submit"
          >
            {isSubmitting ? "Création…" : fr.quotes.form.quickClientCreate}
          </Button>
        </>
      }
    >
      <form
        id="quick-client-form"
        onSubmit={(e) => {
          void handleFormSubmit(e);
        }}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <Input
          label={fr.quotes.form.quickClientName}
          invalid={!!errors.name}
          hint={errors.name?.message}
          data-testid="quick-client-name"
          autoFocus
          {...register("name")}
        />

        <Input
          label={fr.quotes.form.quickClientEmail}
          type="email"
          invalid={!!errors.email}
          hint={errors.email?.message ?? "Optionnel"}
          data-testid="quick-client-email"
          {...register("email")}
        />

        <Input
          label="SIRET"
          invalid={!!errors.siret}
          hint={errors.siret?.message ?? "14 chiffres — optionnel"}
          placeholder="XXX XXX XXX XXXXX"
          data-testid="quick-client-siret"
          {...register("siret")}
        />

        {submitError && (
          <div
            role="alert"
            data-testid="quick-client-error"
            style={{
              border: "2px solid #000",
              background: "#FFF5F5",
              padding: 12,
              fontFamily: "var(--font-ui)",
              fontSize: 14,
            }}
          >
            {submitError}
          </div>
        )}
      </form>
    </Modal>
  );
}
