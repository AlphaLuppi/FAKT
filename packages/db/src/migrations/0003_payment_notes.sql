-- Ajoute la colonne `payment_notes` à la table `invoices` pour stocker
-- les notes libres saisies dans le modal MarkPaid (ex: "Virement reçu le 2026-04-22",
-- "Chèque n°042 encaissé", "Espèces + reçu manuel signé").
--
-- Référence audit : docs/sprint-notes/e2e-wiring-audit.md section 4 — les notes
-- étaient collectées côté UI mais jamais persistées (gap légal archivage 10 ans).

ALTER TABLE invoices ADD COLUMN payment_notes TEXT;
