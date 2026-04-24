import { normalizeSiret } from "@fakt/legal";
import { fr } from "@fakt/shared";
import type { Workspace } from "@fakt/shared";
import { Button, Input, Select, Textarea, toast } from "@fakt/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { api } from "../../../api/index.js";
import { LEGAL_FORM_OPTIONS, identitySchema } from "../../onboarding/validators.js";
import type { IdentityFormValues } from "../../onboarding/validators.js";

interface Props {
  workspace: Workspace | null;
  onSaved?: (updated: Workspace) => void;
}

/**
 * Persiste les settings identity via le sidecar Bun+Hono.
 * Note historique : utilisait auparavant un command Tauri `update_workspace`
 * qui n'était PAS implémenté côté Rust — toute sauvegarde plantait
 * silencieusement. Switch vers l'API sidecar (cohérent avec le flow
 * onboarding `api.workspace.update`).
 */
async function invokeSave(data: IdentityFormValues): Promise<Workspace> {
  const payload = {
    name: data.name,
    legalForm: data.legalForm,
    // Normalise : l'UI accepte "853 665 842 00029" avec espaces, mais l'API
    // attend le SIRET nu. Le schema API fait aussi un transform défensif mais
    // on envoie propre ici (cohérent avec Recap.tsx).
    siret: normalizeSiret(data.siret),
    address: data.address,
    email: data.email,
    iban: data.iban && data.iban.length > 0 ? data.iban : null,
  };
  return api.workspace.update(payload);
}

export function IdentityTab({ workspace, onSaved }: Props): ReactElement {
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<IdentityFormValues>({
    resolver: zodResolver(identitySchema),
    defaultValues: {},
  });

  // Pré-remplir quand workspace est chargé de manière asynchrone
  useEffect(() => {
    if (workspace !== null) {
      reset({
        name: workspace.name,
        legalForm: workspace.legalForm as IdentityFormValues["legalForm"],
        siret: workspace.siret,
        address: workspace.address,
        email: workspace.email,
        iban: workspace.iban ?? "",
        phone: "",
      });
    }
  }, [workspace, reset]);

  const onSubmit: SubmitHandler<IdentityFormValues> = async (values): Promise<void> => {
    // Guard synchrone avant le setState pour empêcher double-submit si React
    // batche les renders (même pattern que Recap.tsx).
    if (saving) return;
    setSaving(true);
    try {
      const updated = await invokeSave(values);
      onSaved?.(updated);
      toast.success(fr.settings.saved);
    } catch (err) {
      const msg = err instanceof Error ? err.message : fr.errors.generic;
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(onSubmit)(e);
      }}
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
    >
      <div style={gridStyle}>
        <Input
          label={fr.settings.workspace.name}
          invalid={!!errors.name}
          hint={errors.name?.message}
          autoComplete="organization"
          {...register("name")}
        />
        <Select
          label={fr.settings.workspace.legalForm}
          options={LEGAL_FORM_OPTIONS}
          invalid={!!errors.legalForm}
          hint={errors.legalForm?.message}
          {...register("legalForm")}
        />
      </div>

      <Input
        label={fr.settings.workspace.siret}
        invalid={!!errors.siret}
        hint={errors.siret?.message}
        style={{ fontFamily: "var(--font-mono)" }}
        {...register("siret")}
      />

      <Textarea
        label={fr.settings.workspace.address}
        invalid={!!errors.address}
        hint={errors.address?.message}
        rows={3}
        {...register("address")}
      />

      <div style={gridStyle}>
        <Input
          label={fr.settings.workspace.email}
          type="email"
          invalid={!!errors.email}
          hint={errors.email?.message}
          {...register("email")}
        />
        <Input label={fr.settings.workspace.phone} type="tel" {...register("phone")} />
      </div>

      <Input
        label={fr.settings.workspace.iban}
        invalid={!!errors.iban}
        hint={errors.iban?.message}
        style={{ fontFamily: "var(--font-mono)" }}
        {...register("iban")}
      />

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button type="submit" disabled={saving || !isDirty}>
          {saving ? "Enregistrement…" : fr.settings.save}
        </Button>
      </div>
    </form>
  );
}

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
};
