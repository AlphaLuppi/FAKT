import { normalizeSiret, validateSiret } from "@fakt/legal";
import { fr } from "@fakt/shared";
import type { Client } from "@fakt/shared";
import { Button, Input, Modal, Select, Textarea } from "@fakt/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactElement } from "react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { SiretCheckerField } from "../../components/siret-checker/index.js";

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
    control,
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
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
            data-testid="client-form-cancel"
          >
            Annuler
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="client-form"
            disabled={isSubmitting}
            data-testid="client-form-submit"
          >
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
        data-testid="client-form"
      >
        <Input
          label={fr.clients.labels.name}
          invalid={!!errors.name}
          hint={errors.name?.message}
          data-testid="client-form-name"
          {...register("name")}
        />

        <Select
          label={fr.clients.labels.legalForm}
          options={LEGAL_FORM_OPTIONS}
          data-testid="client-form-legal-form"
          {...register("legalForm")}
        />

        <Input
          label={fr.clients.labels.siret}
          invalid={!!errors.siret}
          hint={errors.siret?.message ?? "14 chiffres — optionnel"}
          placeholder="732 829 320 00074"
          style={{ fontFamily: "var(--font-mono)" }}
          data-testid="client-form-siret"
          {...register("siret")}
        />
        <SiretCheckerField control={control} name="siret" />

        <Textarea
          label={fr.clients.labels.address}
          rows={3}
          hint="Adresse complète (rue, CP, ville)"
          data-testid="client-form-address"
          {...register("address")}
        />

        <Input
          label={fr.clients.labels.contactName}
          data-testid="client-form-contact-name"
          {...register("contactName")}
        />

        <Input
          label={fr.clients.labels.email}
          type="email"
          invalid={!!errors.email}
          hint={errors.email?.message}
          data-testid="client-form-email"
          {...register("email")}
        />

        <Input
          label={fr.clients.labels.sector}
          hint="Ex : tech, design, conseil…"
          data-testid="client-form-sector"
          {...register("sector")}
        />

        <Textarea
          label={fr.clients.labels.note}
          rows={3}
          data-testid="client-form-note"
          {...register("note")}
        />
      </form>
    </Modal>
  );
}

export type { ClientFormValues };
