-- Triggers de contraintes métier critiques
-- Injectés manuellement en complément des migrations Drizzle.
-- Source : docs/architecture.md section 5.4

-- Append-only enforcement sur signature_events (audit trail)
CREATE TRIGGER IF NOT EXISTS signature_events_no_update
  BEFORE UPDATE ON signature_events
  BEGIN
    SELECT RAISE(ABORT, 'signature_events is append-only');
  END;

CREATE TRIGGER IF NOT EXISTS signature_events_no_delete
  BEFORE DELETE ON signature_events
  BEGIN
    SELECT RAISE(ABORT, 'signature_events is append-only');
  END;

-- Interdit le hard-delete d'une facture émise (conformité archivage 10 ans — CGI)
CREATE TRIGGER IF NOT EXISTS invoices_no_hard_delete_issued
  BEFORE DELETE ON invoices
  WHEN OLD.status != 'draft'
  BEGIN
    SELECT RAISE(ABORT, 'cannot hard-delete issued invoice; use archive');
  END;

-- Numérotation immuable une fois attribuée (devis)
CREATE TRIGGER IF NOT EXISTS quotes_immutable_number
  BEFORE UPDATE ON quotes
  WHEN OLD.number IS NOT NULL
    AND (NEW.number != OLD.number OR NEW.year != OLD.year OR NEW.sequence != OLD.sequence)
  BEGIN
    SELECT RAISE(ABORT, 'quote number is immutable once assigned');
  END;

-- Numérotation immuable une fois attribuée (factures)
CREATE TRIGGER IF NOT EXISTS invoices_immutable_number
  BEFORE UPDATE ON invoices
  WHEN OLD.number IS NOT NULL
    AND (NEW.number != OLD.number OR NEW.year != OLD.year OR NEW.sequence != OLD.sequence)
  BEGIN
    SELECT RAISE(ABORT, 'invoice number is immutable once assigned');
  END;
