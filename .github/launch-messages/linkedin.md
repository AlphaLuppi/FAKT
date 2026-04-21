# LinkedIn — Post de launch

**NE PAS POSTER** avant validation du timing par Tom.

---

## Post LinkedIn (~1400 chars)

J'ai sorti FAKT aujourd'hui. C'est une application desktop open-source pour freelances français.

Il y a 6 mois, je facturais en jonglant entre 6 outils : Word pour les devis, Yousign pour la signature (18 €/mois), Google Drive pour l'archive, un tableur pour le suivi, Indy pour la compta, et une IA dans un onglet pour les relances. Trente euros par mois, une demi-heure par cycle de facturation, et une angoisse permanente sur la conformité légale.

J'ai commencé à bidouiller des scripts Claude Code qui généraient des PDF depuis le terminal. Ça marchait — mais c'était des fichiers isolés, sans persistence ni interface.

Alors j'ai décidé d'aller jusqu'au bout.

FAKT réunit tout ça dans un seul binaire de ~8 Mo :
→ Devis et factures conformes (CGI art. 289, mention TVA art. 293 B)
→ Signature électronique PAdES avancée (niveau eIDAS AdES-B-T) implémentée en Rust, sans Yousign
→ Horodatage RFC 3161, audit trail SHA-256 inviolable
→ Génération IA depuis un brief client (Claude Code CLI, votre token)
→ SQLite local, zéro cloud obligatoire, backup ZIP archive 10 ans
→ Windows, macOS, Linux

Ce qui me tient à cœur : la souveraineté. Vos données restent chez vous. Le code est public et auditable. La signature fonctionne 100% hors-ligne.

Le design s'appelle "Brutal Invoice" — noir, papier off-white, jaune vif, Space Grotesk UPPERCASE. Parce qu'un outil pro peut être mémorable.

C'est publié sous BSL 1.1. Usage personnel, fork, contribution : tout autorisé. Revente en SaaS concurrent : bloquée 4 ans, puis Apache 2.0 automatique en 2030.

Si vous facturez en micro-entreprise et que vous cherchez une alternative souveraine à Indy, Tiime ou Freebe — ou si vous êtes curieux de voir comment implémenter PAdES en Rust — jetez un œil.

GitHub : github.com/AlphaLuppi/FAKT

Retours bienvenus, en particulier sur les cas de TVA assujettie (hors scope v0.1 mais candidat v0.2) et les adaptations Belgique / Suisse / Québec.

— Tom Andrieu, AlphaLuppi

#freelance #openSource #facturation #développement #Tauri #Rust
