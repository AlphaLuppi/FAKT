/**
 * Catalogue des commandes IPC Tauri.
 * Centralise les noms de commandes pour éviter les strings magiques côté frontend.
 */

export const IPC_COMMANDS = {
  // Workspace & Settings
  GET_WORKSPACE: "get_workspace",
  UPDATE_WORKSPACE: "update_workspace",
  GET_SETTINGS: "get_settings",
  UPDATE_SETTINGS: "update_settings",
  CHECK_CLAUDE_CLI: "check_claude_cli",

  // Onboarding
  ONBOARDING_RUN: "onboarding_run",
  GENERATE_USER_CERTIFICATE: "generate_user_certificate",

  // Clients
  LIST_CLIENTS: "list_clients",
  GET_CLIENT: "get_client",
  CREATE_CLIENT: "create_client",
  UPDATE_CLIENT: "update_client",
  ARCHIVE_CLIENT: "archive_client",

  // Services (Prestations)
  LIST_SERVICES: "list_services",
  CREATE_SERVICE: "create_service",
  UPDATE_SERVICE: "update_service",
  ARCHIVE_SERVICE: "archive_service",

  // Quotes
  LIST_QUOTES: "list_quotes",
  GET_QUOTE: "get_quote",
  CREATE_QUOTE: "create_quote",
  UPDATE_QUOTE: "update_quote",
  ISSUE_QUOTE: "issue_quote",
  EXPIRE_QUOTE: "expire_quote",
  CANCEL_QUOTE: "cancel_quote",
  DUPLICATE_QUOTE: "duplicate_quote",

  // Invoices
  LIST_INVOICES: "list_invoices",
  GET_INVOICE: "get_invoice",
  CREATE_INVOICE_FROM_QUOTE: "create_invoice_from_quote",
  CREATE_INVOICE_INDEPENDENT: "create_invoice_independent",
  MARK_INVOICE_PAID: "mark_invoice_paid",
  ARCHIVE_INVOICE: "archive_invoice",

  // Numbering
  PREVIEW_NEXT_NUMBER: "preview_next_number",

  // PDF
  RENDER_QUOTE_PDF: "render_quote_pdf",
  RENDER_INVOICE_PDF: "render_invoice_pdf",
  GET_PDF_PATH: "get_pdf_path",

  // Signature
  SIGN_DOCUMENT: "sign_document",
  GET_SIGNATURE_EVENTS: "get_signature_events",
  VERIFY_AUDIT_CHAIN: "verify_audit_chain",

  // AI
  AI_IS_AVAILABLE: "ai_is_available",
  AI_EXTRACT_QUOTE: "ai_extract_quote_from_brief",
  AI_EXTRACT_QUOTE_STREAM: "ai_extract_quote_stream",
  AI_GENERATE_EMAIL_REMINDER: "ai_generate_email_reminder",
  AI_SUGGEST_SERVICE: "ai_suggest_service",

  // Email
  PREPARE_EMAIL_DRAFT: "prepare_email_draft",
  OPEN_EMAIL_DRAFT: "open_email_draft",

  // Backup & Export
  TRIGGER_BACKUP_NOW: "trigger_backup_now",
  LIST_BACKUPS: "list_backups",
  EXPORT_WORKSPACE_ZIP: "export_workspace_zip",
  EXPORT_DOCUMENT_PDF: "export_document_pdf",

  // Telemetry
  TELEMETRY_OPT_IN: "telemetry_opt_in",
  TELEMETRY_TRACK: "telemetry_track",

  // Dev / utils
  PING: "ping",
  GET_VERSION: "get_version",
} as const;

export type IpcCommand = (typeof IPC_COMMANDS)[keyof typeof IPC_COMMANDS];

export const IPC_EVENTS = {
  WORKSPACE_UPDATED: "workspace-updated",
  MIGRATION_PROGRESS: "migration-progress",
  BACKUP_COMPLETED: "backup-completed",
  CLAUDE_CLI_STATUS_CHANGED: "claude-cli-status-changed",
  DOCUMENT_STATUS_CHANGED: "document-status-changed",
  INVOICE_OVERDUE_DETECTED: "invoice-overdue-detected",
  SIGNATURE_EMBED_DONE: "signature-embed-done",
} as const;

export type IpcEvent = (typeof IPC_EVENTS)[keyof typeof IPC_EVENTS];
