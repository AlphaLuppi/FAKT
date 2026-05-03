-- Hash SHA-256 du texte normalisé du PDF officiel à l'émission du devis.
--
-- Persisté pour vérifier l'intégrité d'un PDF retourné signé par le client
-- (workflow V0.2 « Importer signature client ») : on extrait le texte du PDF
-- importé, on hash, on compare. Identique → accept direct. Différent → modal
-- de confirmation forcée.
--
-- NULL = devis créé avant cette feature ou jamais émis. L'import retournera
-- une erreur explicite et l'utilisateur devra ré-émettre (impossible si déjà
-- signé) ou utiliser le bouton signature classique.

ALTER TABLE quotes ADD COLUMN original_text_hash TEXT;
