import { activityApi } from "./activity.js";
import { backupsApi } from "./backups.js";
import { clientsApi } from "./clients.js";
import { invoicesApi } from "./invoices.js";
import { numberingApi } from "./numbering.js";
import { quotesApi } from "./quotes.js";
import { servicesApi } from "./services.js";
import { settingsApi } from "./settings.js";
import { signaturesApi } from "./signatures.js";
import { workspaceApi } from "./workspace.js";

export {
  ApiClient,
  ApiError,
  getApiClient,
  setApiClient,
  IS_TAURI,
  type ApiErrorCode,
} from "./client.js";

export { workspaceApi } from "./workspace.js";
export { clientsApi } from "./clients.js";
export { servicesApi } from "./services.js";
export { quotesApi } from "./quotes.js";
export { invoicesApi } from "./invoices.js";
export { settingsApi } from "./settings.js";
export { numberingApi } from "./numbering.js";
export { activityApi } from "./activity.js";
export { signaturesApi } from "./signatures.js";
export { backupsApi } from "./backups.js";

export * from "./workspace.js";
export type {
  ListClientsInput,
  CreateClientInput,
  UpdateClientInput,
} from "./clients.js";
export type {
  ListServicesInput,
  CreateServiceInput,
  UpdateServiceInput,
} from "./services.js";
export type {
  ListQuotesInput,
  CreateQuoteInput,
  UpdateQuoteInput,
  QuoteItemInput,
} from "./quotes.js";
export type {
  ListInvoicesInput,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  FromQuoteInput,
  MarkPaidInput,
  InvoiceItemInput,
} from "./invoices.js";
export type { SettingEntry } from "./settings.js";
export type { NumberingType, NumberingResult } from "./numbering.js";
export type {
  ActivityEvent,
  ActivityEntityType,
  ListActivityInput,
  AppendActivityInput,
} from "./activity.js";
export type {
  DocumentType,
  AppendSignatureEventInput,
  SignedDocumentMeta,
  UpsertSignedDocumentInput,
  VerifyChainResult,
} from "./signatures.js";
export type { BackupRecord, ListBackupsInput, InsertBackupInput } from "./backups.js";

/**
 * Objet `api` centralisé : point d'entrée unique pour le frontend.
 * Usage : `import { api } from "@/api"; api.clients.list()`.
 */
export const api = {
  workspace: workspaceApi,
  clients: clientsApi,
  services: servicesApi,
  quotes: quotesApi,
  invoices: invoicesApi,
  settings: settingsApi,
  numbering: numberingApi,
  activity: activityApi,
  signatures: signaturesApi,
  backups: backupsApi,
} as const;
