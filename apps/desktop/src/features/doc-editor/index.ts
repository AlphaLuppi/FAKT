/**
 * features/doc-editor — Composants et services partagés par les deux
 * éditeurs de documents (devis H1, factures H2).
 *
 * Re-exporte `ItemsEditor` et `ClientPicker` afin que H2 puisse les
 * importer sans duplication. Voir docs/sprint-briefs-wave2.md.
 */

export { ItemsEditor } from "./ItemsEditor.js";
export type { ItemsEditorProps, EditableItem } from "./ItemsEditor.js";

export { ClientPicker } from "./ClientPicker.js";
export type { ClientPickerProps } from "./ClientPicker.js";

export { QuickClientModal } from "./QuickClientModal.js";
export type { QuickClientModalProps } from "./QuickClientModal.js";

export { InvoiceForm, invoiceToFormValues } from "./InvoiceForm.js";
export type {
  InvoiceFormProps,
  InvoiceFormValues,
} from "./InvoiceForm.js";

export { quotesApi, setQuotesApi, type QuotesApi } from "./quotes-api.js";
export {
  workspaceApi,
  setWorkspaceApi,
  type WorkspaceApi,
} from "./workspace-api.js";
export { clientsApi, setClientsApi, type ClientsApi } from "./clients-api.js";
export {
  prestationsApi,
  setPrestationsApi,
  type PrestationsApi,
} from "./prestations-api.js";
export { numberingApi, setNumberingApi, type NumberingApi } from "./numbering-api.js";
export { pdfApi, setPdfApi, type PdfApi } from "./pdf-api.js";
export {
  invoiceApi,
  setInvoiceApi,
  type InvoiceApi,
  type CreateInvoiceInput,
  type CreateFromQuoteInput,
  type CreateFromQuoteMode,
  type UpdateInvoiceInput,
  type ListInvoicesInput,
  type InvoiceItemInput,
  type MarkPaidInput,
} from "./invoice-api.js";
export {
  signatureApi,
  setSignatureApi,
  type SignatureApi,
  type SignDocumentInput,
  type SignDocumentOutput,
  type VerifyReport,
} from "./signature-api.js";
