-- Imports historiques : devis et factures déjà émis hors FAKT que l'utilisateur
-- veut charger dans la base pour l'historique, les statistiques et le suivi client.
--
-- Ces documents :
--   - n'occupent PAS la séquence FAKT (CGI art. 289 conservé : `number/year/sequence` restent NULL)
--   - portent un `external_number` libre (ex. "DEVIS-2024-CASA")
--   - portent un `imported_at` timestamp pour les distinguer des docs FAKT natifs
--   - peuvent être créés directement en statut "signed" (devis) ou "paid" (facture)

ALTER TABLE quotes ADD COLUMN external_number TEXT;
ALTER TABLE quotes ADD COLUMN imported_at INTEGER;

ALTER TABLE invoices ADD COLUMN external_number TEXT;
ALTER TABLE invoices ADD COLUMN imported_at INTEGER;

-- Index pour filtrer rapidement la liste "imports uniquement" et le filtre opposé.
CREATE INDEX IF NOT EXISTS quotes_imported_idx ON quotes(imported_at) WHERE imported_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS invoices_imported_idx ON invoices(imported_at) WHERE imported_at IS NOT NULL;
