import { fr } from "@fakt/shared";
import type { DocumentUnit, Service } from "@fakt/shared";
import { Button, Input, Modal, Select, Textarea } from "@fakt/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactElement } from "react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const UNIT_OPTIONS = Object.entries(fr.services.units).map(([value, label]) => ({
  value,
  label,
}));

const PREDEFINED_TAGS = [
  "dev",
  "design",
  "conseil",
  "formation",
  "rédaction",
  "support",
  "maintenance",
  "audit",
  "web",
  "mobile",
];

const prestationFormSchema = z.object({
  name: z.string().min(1, "Le nom est obligatoire"),
  description: z.string().nullable().optional(),
  unit: z.enum(["forfait", "jour", "heure", "unité", "mois", "semaine"]),
  unitPriceCents: z
    .number({ invalid_type_error: "Le prix doit être un nombre" })
    .int("Le prix doit être en centimes (entier)")
    .nonnegative("Le prix ne peut pas être négatif"),
  tags: z.array(z.string()).nullable().optional(),
});

type PrestationFormValues = z.infer<typeof prestationFormSchema>;

export interface PrestationFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: PrestationFormValues) => Promise<void>;
  initial?: Service | null;
}

export function PrestationForm({
  open,
  onClose,
  onSubmit,
  initial,
}: PrestationFormProps): ReactElement {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PrestationFormValues>({
    resolver: zodResolver(prestationFormSchema),
    defaultValues: {
      name: "",
      description: null,
      unit: "forfait",
      unitPriceCents: 0,
      tags: null,
    },
  });

  const selectedTags = watch("tags") ?? [];

  useEffect(() => {
    if (open) {
      reset({
        name: initial?.name ?? "",
        description: initial?.description ?? null,
        unit: (initial?.unit ?? "forfait") as DocumentUnit,
        unitPriceCents: initial?.unitPriceCents ?? 0,
        tags: initial?.tags ?? null,
      });
    }
  }, [open, initial, reset]);

  const toggleTag = (tag: string): void => {
    const current = selectedTags ?? [];
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    setValue("tags", next.length > 0 ? next : null);
  };

  const handleFormSubmit = handleSubmit(async (values) => {
    await onSubmit(values);
    onClose();
  });

  const isEdit = initial != null;

  // Affichage du prix en euros pour l'input
  const priceEuros = watch("unitPriceCents") / 100;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? fr.services.title : fr.services.new}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="prestation-form" disabled={isSubmitting}>
            {isSubmitting ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <form
        id="prestation-form"
        onSubmit={(e) => {
          void handleFormSubmit(e);
        }}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <Input
          label={fr.services.labels.name}
          invalid={!!errors.name}
          hint={errors.name?.message}
          {...register("name")}
        />

        <Textarea label={fr.services.labels.description} rows={3} {...register("description")} />

        <Select
          label={fr.services.labels.unit}
          options={UNIT_OPTIONS}
          invalid={!!errors.unit}
          hint={errors.unit?.message}
          {...register("unit")}
        />

        <Input
          label={fr.services.labels.unitPrice}
          type="number"
          step="0.01"
          min="0"
          invalid={!!errors.unitPriceCents}
          hint={errors.unitPriceCents?.message ?? "Prix HT en euros (ex: 750.00)"}
          value={priceEuros}
          onChange={(e) => {
            const euros = Number.parseFloat(e.currentTarget.value) || 0;
            setValue("unitPriceCents", Math.round(euros * 100));
          }}
        />

        {/* Tags */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontWeight: 700,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--ink)",
            }}
          >
            {fr.services.labels.tags}
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {PREDEFINED_TAGS.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  style={{
                    padding: "4px 10px",
                    border: "1.5px solid var(--ink)",
                    background: active ? "var(--ink)" : "transparent",
                    color: active ? "var(--paper)" : "var(--ink)",
                    fontSize: 11,
                    fontFamily: "var(--font-ui)",
                    fontWeight: 700,
                    cursor: "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      </form>
    </Modal>
  );
}

export type { PrestationFormValues };
