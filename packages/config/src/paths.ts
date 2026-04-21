/** Constantes chemins de l'application. Résolution finale côté Rust via dirs::data_dir(). */

export const APP_NAME = "FAKT" as const;

/** Noms de sous-dossiers relatifs à data_dir()/FAKT/. */
export const APP_PATHS = {
  DB: "fakt.db",
  DOCUMENTS: "documents",
  BACKUPS: "backups",
  KEYS: "keys",
  LOGS: "logs",
} as const;
