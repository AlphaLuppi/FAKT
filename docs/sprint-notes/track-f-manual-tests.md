# Track F — Tests manuels Onboarding + Settings

## Prérequis

- `bun run tauri:dev` lancé
- Base de données vide (supprimer `~/.fakt/data/fakt.db` si existante)

## Scénario 1 — Premier lancement → wizard

1. Lancer FAKT depuis un état vierge (aucune DB).
2. Vérifier que le wizard s'affiche (page Identité légale, étape 1/4).
3. Vérifier l'affichage de la barre de progression (4 étapes).
4. Tenter de cliquer "Suivant" sans remplir le formulaire → bouton désactivé.
5. Saisir un SIRET invalide → message d'erreur "SIRET invalide (clé Luhn incorrecte)".
6. Saisir un SIRET valide (ex : 732 829 320 00074), nom, adresse, email.
7. Cliquer "Suivant" → passe à l'étape Claude CLI.

## Scénario 2 — Étape Claude CLI (FR-003)

1. Être à l'étape 2.
2. Vérifier que le check CLI se lance automatiquement au mount.
3. Si CLI installé : badge vert "Claude CLI détecté" + version.
4. Si CLI absent : message d'installation + bouton "Ouvrir la page d'installation".
5. Cocher "Je configurerai Claude plus tard" → bouton "Suivant" s'active.
6. Cliquer "Suivant" → passe à l'étape Certificat.

## Scénario 3 — Génération certificat (FR-002)

1. Être à l'étape 3.
2. Cliquer "Générer mon certificat".
3. Vérifier le spinner "RSA 4096 bits, quelques secondes…".
4. Après génération : affichage DN, empreinte SHA-256, dates validité (10 ans).
5. Vérifier que le bouton "Suivant" s'active.
6. Test erreur keychain : simuler un trousseau inaccessible → toast d'erreur + bouton "Réessayer".

## Scénario 4 — Récapitulatif + finalisation

1. Être à l'étape 4.
2. Vérifier l'affichage des 3 cartes (Identité, CLI, Certificat).
3. Cliquer "C'est parti !" → redirection vers le dashboard.
4. Relancer l'app → le wizard ne s'affiche plus (guard setupCompletedAt).

## Scénario 5 — Settings (FR-004)

1. Depuis le dashboard, cliquer sur "Paramètres" dans la sidebar.
2. Vérifier l'affichage des 4 tabs (Identité, Claude CLI, Certificat, Télémétrie).
3. Tab Identité : pré-remplissage correct avec les données de l'onboarding.
4. Modifier le nom → cliquer "Enregistrer" → toast "Enregistré" + mise à jour.
5. Tab Claude CLI : vérifier l'état actuel + bouton "Vérifier à nouveau".
6. Tab Certificat : affichage empreinte + validité restante.
7. Cliquer "Régénérer le certificat" → modal de warning s'affiche.
8. Annuler → modal se ferme, aucun changement.
9. Confirmer → nouveau certificat généré, toast de succès.
10. Tab Télémétrie : checkbox désactivée par défaut. Activer → toast. Désactiver → toast.

## Résultats attendus

| Test | Critère | Statut |
|------|---------|--------|
| Guard premier lancement | Wizard affiché si setupCompletedAt NULL | À valider |
| Guard retour | Dashboard direct si setupCompletedAt SET | À valider |
| SIRET validation temps réel | Erreur Luhn visible immédiatement | À valider |
| IBAN validation | Erreur si format invalide | À valider |
| CLI non-bloquant (FR-003) | Skip possible via checkbox | À valider |
| Génération cert (FR-002) | RSA 4096 + keychain + affichage DN/empreinte | À valider |
| Settings 4 tabs | Navigation fluide + pré-remplissage | À valider |
| Rotate cert warning modal | Warning + audit trail | À valider |
