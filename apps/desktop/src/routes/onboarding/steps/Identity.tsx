import { fr } from "@fakt/shared";
import { Button, Input, Select, Textarea } from "@fakt/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactElement } from "react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { ApiError, api } from "../../../api/index.js";
import { SiretCheckerField } from "../../../components/siret-checker/index.js";
import { useOnboarding } from "../context.js";
import { LEGAL_FORM_OPTIONS, identitySchema } from "../validators.js";
import type { IdentityFormValues } from "../validators.js";

interface Props {
  onNext: () => void;
}

export function IdentityStep({ onNext }: Props): ReactElement {
  const { state, setIdentity } = useOnboarding();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isValid },
  } = useForm<IdentityFormValues>({
    resolver: zodResolver(identitySchema),
    mode: "onChange",
    defaultValues: state.identity ?? {
      name: "",
      legalForm: "Micro-entreprise",
      siret: "",
      address: "",
      email: "",
      iban: "",
      phone: "",
    },
  });

  // Pré-remplir depuis le workspace existant (si l'utilisateur revient sur
  // l'onboarding alors que son workspace est déjà créé — soit après un wipe
  // de `setup_state.completed_at`, soit après un bug qui re-redirige vers
  // /onboarding). Evite à l'utilisateur de tout resaisir.
  useEffect(() => {
    // Ne pas écraser les valeurs déjà saisies pendant le flow.
    if (state.identity !== null) return;

    let cancelled = false;
    void (async () => {
      try {
        const ws = await api.workspace.get();
        if (cancelled || !ws) return;
        reset({
          name: ws.name,
          legalForm: (ws.legalForm as IdentityFormValues["legalForm"]) ?? "Micro-entreprise",
          siret: ws.siret,
          address: ws.address,
          email: ws.email,
          iban: ws.iban ?? "",
          phone: "",
        });
      } catch (err) {
        // Workspace pas encore créé (NOT_FOUND) ou sidecar injoignable
        // (NETWORK_ERROR) — on laisse les defaults vides.
        if (err instanceof ApiError) return;
        // Autre erreur silencieuse : ne pas casser l'onboarding.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.identity, reset]);

  function onSubmit(values: IdentityFormValues): void {
    setIdentity(values);
    onNext();
  }

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(onSubmit)(e);
      }}
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
    >
      <div>
        <h2 style={headingStyle}>{fr.onboarding.step1.title}</h2>
        <p style={descStyle}>{fr.onboarding.step1.description}</p>
      </div>

      <div style={gridStyle}>
        <Input
          label={fr.onboarding.step1.fields.name}
          invalid={!!errors.name}
          hint={errors.name?.message}
          autoComplete="organization"
          {...register("name")}
        />
        <Select
          label={fr.onboarding.step1.fields.legalForm}
          options={LEGAL_FORM_OPTIONS}
          invalid={!!errors.legalForm}
          hint={errors.legalForm?.message}
          {...register("legalForm")}
        />
      </div>

      <Input
        label={fr.onboarding.step1.fields.siret}
        invalid={!!errors.siret}
        hint={errors.siret?.message ?? "14 chiffres — ex : 732 829 320 00074"}
        placeholder="732 829 320 00074"
        maxLength={17}
        inputMode="numeric"
        style={{ fontFamily: "var(--font-mono)" }}
        {...register("siret")}
      />
      <SiretCheckerField control={control} name="siret" />

      <Textarea
        label={fr.onboarding.step1.fields.address}
        invalid={!!errors.address}
        hint={errors.address?.message}
        rows={3}
        placeholder={"12 rue de la République\n13001 Marseille"}
        {...register("address")}
      />

      <div style={gridStyle}>
        <Input
          label={fr.onboarding.step1.fields.email}
          type="email"
          invalid={!!errors.email}
          hint={errors.email?.message}
          autoComplete="email"
          {...register("email")}
        />
        <Input
          label={fr.onboarding.step1.fields.phone}
          type="tel"
          invalid={!!errors.phone}
          hint={errors.phone?.message}
          autoComplete="tel"
          {...register("phone")}
        />
      </div>

      <Input
        label={fr.onboarding.step1.fields.iban}
        invalid={!!errors.iban}
        hint={errors.iban?.message ?? "Optionnel — ex : FR76 3000 6000 0112 3456 7890 189"}
        placeholder="FR76 ..."
        style={{ fontFamily: "var(--font-mono)" }}
        {...register("iban")}
      />

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button type="submit" disabled={!isValid}>
          {fr.onboarding.next}
        </Button>
      </div>
    </form>
  );
}

const headingStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-ui)",
  fontWeight: "var(--w-black)" as unknown as number,
  fontSize: "var(--t-xl)",
  textTransform: "uppercase",
  letterSpacing: "-0.01em",
  color: "var(--ink)",
};

const descStyle: React.CSSProperties = {
  margin: "8px 0 0",
  fontFamily: "var(--font-ui)",
  fontSize: "var(--t-sm)",
  color: "var(--muted)",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
};
