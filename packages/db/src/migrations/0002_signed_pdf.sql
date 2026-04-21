-- Stockage des chemins de PDF signés (Track I).
--
-- Les bytes eux-mêmes sont persistés par la couche Rust dans
-- `<app_data>/signed/<doc_type>-<doc_id>.pdf`. Cette table mémorise uniquement
-- le chemin + métadonnées (TSA provider, niveau PAdES) pour un lookup rapide
-- côté UI et pour l'export backup v0.2.

CREATE TABLE IF NOT EXISTS signed_documents (
  document_type TEXT NOT NULL CHECK (document_type IN ('quote', 'invoice')),
  document_id TEXT NOT NULL,
  path TEXT NOT NULL,
  pades_level TEXT NOT NULL CHECK (pades_level IN ('B', 'B-T')),
  tsa_provider TEXT,
  signed_at INTEGER NOT NULL,
  signature_event_id TEXT NOT NULL,
  PRIMARY KEY (document_type, document_id)
);

CREATE INDEX IF NOT EXISTS signed_documents_event_idx
  ON signed_documents(signature_event_id);
