import { z } from "zod";

/** Schéma settings workspace — stocké dans la table settings (K/V JSON). */

export const workspaceSettingsSchema = z.object({
  /** PEM public du certificat X.509 de signature — stocké en clair (pubKey). */
  certPublicPem: z.string().optional(),

  /** Délai de paiement par défaut en jours. */
  defaultPaymentDays: z.number().int().min(0).max(365).default(30),

  /** Conditions générales par défaut (texte libre, pré-rempli dans les devis). */
  defaultConditions: z.string().optional(),

  /** Opt-in télémétrie anonyme (Plausible). */
  telemetryEnabled: z.boolean().default(false),

  /** Nombre de jours avant expiration d'un devis. */
  quoteValidityDays: z.number().int().min(1).max(365).default(30),

  /** Template email de relance facture (texte libre). */
  reminderEmailTemplate: z.string().optional(),
});

export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema>;

export const SETTINGS_KEYS = {
  CERT_PUBLIC_PEM: "cert_public_pem",
  DEFAULT_PAYMENT_DAYS: "default_payment_days",
  DEFAULT_CONDITIONS: "default_conditions",
  TELEMETRY_ENABLED: "telemetry_enabled",
  QUOTE_VALIDITY_DAYS: "quote_validity_days",
  REMINDER_EMAIL_TEMPLATE: "reminder_email_template",
} as const;
