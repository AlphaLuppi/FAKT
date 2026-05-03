-- Clauses contractuelles cochées par l'utilisateur dans l'éditeur de devis.
--
-- Stocke un JSON array d'IDs de clauses prédéfinies (catalogue figé dans
-- `@fakt/legal/clauses`). Ex: `["deposit-30","warranty-12","ip-transfer"]`.
--
-- NULL = aucune clause cochée (état par défaut, devis pré-existants compatibles).
--
-- Le rendu Typst hydrate les IDs vers les libellés et bodies au moment du
-- rendu PDF — la donnée canonique en DB reste l'identifiant stable, pas le
-- texte (qui peut évoluer entre versions de FAKT sans casser les anciens
-- devis).

ALTER TABLE quotes ADD COLUMN clauses TEXT;
