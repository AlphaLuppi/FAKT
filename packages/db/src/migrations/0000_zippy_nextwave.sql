CREATE TABLE `activity` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`type` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`payload` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `activity_created_idx` ON `activity` (`created_at`);--> statement-breakpoint
CREATE TABLE `backups` (
	`id` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`legal_form` text,
	`siret` text,
	`address` text,
	`contact_name` text,
	`email` text,
	`sector` text,
	`first_collab` integer,
	`note` text,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `clients_name_idx` ON `clients` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `clients_email_ws_uq` ON `clients` (`workspace_id`,`email`);--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`position` integer NOT NULL,
	`description` text NOT NULL,
	`quantity_milli` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`unit` text NOT NULL,
	`line_total_cents` integer NOT NULL,
	`service_id` text,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`client_id` text NOT NULL,
	`quote_id` text,
	`number` text,
	`year` integer,
	`sequence` integer,
	`kind` text NOT NULL,
	`deposit_percent` integer,
	`title` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`total_ht_cents` integer DEFAULT 0 NOT NULL,
	`due_date` integer,
	`paid_at` integer,
	`payment_method` text,
	`payment_notes` text,
	`legal_mentions` text NOT NULL,
	`issued_at` integer,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `invoices_status_idx` ON `invoices` (`status`);--> statement-breakpoint
CREATE INDEX `invoices_due_idx` ON `invoices` (`due_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_number_uq` ON `invoices` (`workspace_id`,`year`,`sequence`);--> statement-breakpoint
CREATE TABLE `numbering_state` (
	`workspace_id` text NOT NULL,
	`year` integer NOT NULL,
	`type` text NOT NULL,
	`last_sequence` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `numbering_pk` ON `numbering_state` (`workspace_id`,`year`,`type`);--> statement-breakpoint
CREATE TABLE `quote_items` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`position` integer NOT NULL,
	`description` text NOT NULL,
	`quantity_milli` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`unit` text NOT NULL,
	`line_total_cents` integer NOT NULL,
	`service_id` text,
	FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `quote_items_pos_idx` ON `quote_items` (`quote_id`,`position`);--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`client_id` text NOT NULL,
	`number` text,
	`year` integer,
	`sequence` integer,
	`title` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`total_ht_cents` integer DEFAULT 0 NOT NULL,
	`conditions` text,
	`validity_date` integer,
	`notes` text,
	`issued_at` integer,
	`signed_at` integer,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `quotes_status_idx` ON `quotes` (`status`);--> statement-breakpoint
CREATE INDEX `quotes_client_idx` ON `quotes` (`client_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_number_uq` ON `quotes` (`workspace_id`,`year`,`sequence`);--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`unit` text NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`tags` text,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`workspace_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settings_workspace_id_key_unique` ON `settings` (`workspace_id`,`key`);--> statement-breakpoint
CREATE TABLE `signature_events` (
	`id` text PRIMARY KEY NOT NULL,
	`document_type` text NOT NULL,
	`document_id` text NOT NULL,
	`signer_name` text NOT NULL,
	`signer_email` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`timestamp` integer NOT NULL,
	`doc_hash_before` text NOT NULL,
	`doc_hash_after` text NOT NULL,
	`signature_png_base64` text NOT NULL,
	`previous_event_hash` text,
	`tsa_response` text,
	`tsa_provider` text
);
--> statement-breakpoint
CREATE INDEX `sigevents_doc_idx` ON `signature_events` (`document_type`,`document_id`);--> statement-breakpoint
CREATE INDEX `sigevents_prev_idx` ON `signature_events` (`previous_event_hash`);--> statement-breakpoint
CREATE TABLE `signed_documents` (
	`document_type` text NOT NULL,
	`document_id` text NOT NULL,
	`path` text NOT NULL,
	`pades_level` text NOT NULL,
	`tsa_provider` text,
	`signed_at` integer NOT NULL,
	`signature_event_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `signed_documents_event_idx` ON `signed_documents` (`signature_event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `signed_documents_pk` ON `signed_documents` (`document_type`,`document_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`legal_form` text NOT NULL,
	`siret` text NOT NULL,
	`address` text NOT NULL,
	`email` text NOT NULL,
	`iban` text,
	`tva_mention` text DEFAULT 'TVA non applicable, art. 293 B du CGI' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
