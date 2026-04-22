import { normalizeSiret, validateSiret } from "@fakt/legal";
import { fr } from "@fakt/shared";
import type { Client } from "@fakt/shared";
import { Button, Input, Modal, Select, Textarea } from "@fakt/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactElement } from "react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const LEGAL_FORM_OPTIONS = [
  { value: "", label: "— Forme juridique —" },
  { value: "Micro-entreprise", label: "Micro-entreprise" },
  { value: "EI", label: "EI (Entreprise Individuelle)" },
  { value: "EURL", label: "EURL" },
  { value: "SASU", label: "SASU" },
  { value: "SAS", label: "SAS" },
  { value: "SARL", label: "SARL" },
  { value: "SA", label: "SA" },
  { value: "Autre", label: "Autre" },
];

const clientFormSchema = z.object({
  name: z.string().min(1, "Le nom est obligatoire"),
  legalForm: z.string().nullable().optional(),
  siret: z
    .string()
    .nullable()
    .optional()
    .refine((val) => {
      if (!val || val.trim() === "") return true;
      return validateSiret(normalizeSiret(val));
    }, fr.errors.siretInvalid),
  address: z.string().nullable().optional(),
  contactName: z.string().nullable().optional(),
  email: z.string().email("Email invalide").nullable().or(z.literal("")).optional(),
  sector: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

type ClientFormValues = z.infer<typeof clientFormSchema>;

export interface ClientFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: ClientFormValues) => Promise<void>;
  initial?: Client | null;
}

export function ClientForm({ open, onClose, onSubmit, initial }: ClientFormProps): ReactElement {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: "",
      legalForm: null,
      siret: null,
      address: null,
      contactName: null,
      email: null,
      sector: null,
      note: null,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: initial?.name ?? "",
        legalForm: initial?.legalForm ?? null,
        siret: initial?.siret ?? null,
        address: initial?.address ?? null,
        contactName: initial?.contactName ?? null,
        email: initial?.email ?? null,
        sector: initial?.sector ?? null,
        note: initial?.note ?? null,
      });
    }
  }, [open, initial, reset]);

  const handleFormSubmit = handleSubmit(async (values) => {
    await onSubmit(values);
    onClose();
  });

  const isEdit = initial != null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? fr.clients.actions.edit : fr.clients.new}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="client-form" disabled={isSubmitting}>
            {isSubmitting ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <form
        id="client-form"
        onSubmit={(e) => {
          void handleFormSubmit(e);
        }}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <Input
          label={fr.clients.labels.name}
          invalid={!!errors.name}
          hint={errors.name?.message}
          {...register("name")}
        />

        <Select
          label={fr.clients.labels.legalForm}
          options={LEGAL_FORM_OPTIONS}
          {...register("legalForm")}
        />

        <Input
          label={fr.clients.labels.siret}
          invalid={!!errors.siret}
          hint={errors.siret?.message ?? "14 chiffres — optionnel"}
          placeholder="XXX XXX XXX XXXXX"
          style={{ fontFamily: "var(--font-mono)" }}
          {...register("siret")}
        />

        <Textarea
          label={fr.clients.labels.address}
          rows={3}
          hint="Adresse complète (rue, CP, ville)"
          {...register("address")}
        />

        <Input label={fr.clients.labels.contactName} {...register("contactName")} />

        <Input
          label={fr.clients.labels.email}
          type="email"
          invalid={!!errors.email}
          hint={errors.email?.message}
          {...register("email")}
        />

        <Input
          label={fr.clients.labels.sector}
          hint="Ex : tech, design, conseil…"
          {...register("sector")}
        />

        <Textarea label={fr.clients.labels.note} rows={3} {...register("note")} />
      </form>
    </Modal>
  );
}

export type { ClientFormValues };
