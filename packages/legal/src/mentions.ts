import type { LegalForm } from "@fakt/shared";

/**
 * Mentions légales obligatoires sur les factures françaises.
 * Sources : CGI art. 289, LME art. 21, D. n° 2012-1115.
 */

/** Mention TVA pour micro-entreprise — texte EXACT imposé par l'art. 293 B du CGI. */
export const TVA_MENTION_MICRO: string =
  "TVA non applicable, art. 293 B du CGI";

/** Taux de pénalité de retard légal (3× taux légal — LME art. 21). */
export const LATE_PAYMENT_PENALTY_RATE: string =
  "En cas de retard de paiement, une pénalité égale à 3 fois le taux d'intérêt légal sera appliquée.";

/** Indemnité forfaitaire pour frais de recouvrement (D. n° 2012-1115). */
export const LUMP_SUM_INDEMNITY: string =
  "Une indemnité forfaitaire de 40 € sera due pour frais de recouvrement en cas de retard (D. n° 2012-1115).";

export type FiscalRegime = "micro" | "tva";
export type DocumentType = "quote" | "invoice";

export interface MandatoryMentionsInput {
  regime: FiscalRegime;
  type: DocumentType;
  /** Montant HT en centimes — pour contexte (non utilisé dans mentions text MVP). */
  amount: number;
}

export interface MandatoryMentions {
  tvaMention: string;
  latePenalty: string;
  lumpSumIndemnity: string;
  /** Mentions supplémentaires spécifiques au type de document. */
  documentSpecific: string[];
}

/**
 * Retourne l'ensemble des mentions légales obligatoires pour un document donné.
 * Conforme CGI art. 289 + LME art. 21 + D. 2012-1115.
 */
export function getMandatoryMentions(
  input: MandatoryMentionsInput
): MandatoryMentions {
  const tvaMention = isVatExempt(input.regime)
    ? TVA_MENTION_MICRO
    : "TVA applicable";

  const documentSpecific: string[] = [];

  if (input.type === "invoice") {
    documentSpecific.push(LATE_PAYMENT_PENALTY_RATE);
    documentSpecific.push(LUMP_SUM_INDEMNITY);
  }

  return {
    tvaMention,
    latePenalty: LATE_PAYMENT_PENALTY_RATE,
    lumpSumIndemnity: LUMP_SUM_INDEMNITY,
    documentSpecific,
  };
}

/**
 * Vérifie si le régime fiscal est exempté de TVA (micro-entreprise).
 * Retourne true pour les micro-entreprises — la mention art. 293 B doit apparaître.
 */
export function isVatExempt(regime: FiscalRegime): boolean {
  return regime === "micro";
}

/**
 * Génère le texte complet des mentions légales pour snapshot dans la DB.
 * Ce texte est stocké dans invoices.legal_mentions au moment de l'émission.
 */
export function buildLegalMentionsSnapshot(
  workspace: {
    name: string;
    legalForm: LegalForm;
    siret: string;
    address: string;
    iban: string | null;
    tvaMention: string;
  },
  paymentDays: number = 30
): string {
  const lines: string[] = [
    `${workspace.legalForm} ${workspace.name}`,
    `SIRET : ${workspace.siret}`,
    `${workspace.address}`,
    workspace.tvaMention,
    `Paiement à ${paymentDays} jours date de facture.`,
    LATE_PAYMENT_PENALTY_RATE,
    LUMP_SUM_INDEMNITY,
  ];

  if (workspace.iban) {
    lines.splice(3, 0, `IBAN : ${workspace.iban}`);
  }

  return lines.join("\n");
}
