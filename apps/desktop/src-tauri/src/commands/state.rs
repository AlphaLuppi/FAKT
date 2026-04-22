//! État partagé Tauri pour les commandes Track I.
//!
//! En v0.1 (solo-local), on stocke :
//! - Les compteurs de numérotation séquentielle par (workspace, année, type)
//!   dans une table SQLite dédiée (`numbering_state`) — accès en
//!   `BEGIN IMMEDIATE` pour garantir l'atomicité CGI art. 289.
//! - Un cache des PDF signés en mémoire, indexé par (doc_type, doc_id), persisté
//!   sur disque sous `<app_data_dir>/signed/<doc_type>-<doc_id>.pdf`.
//!
//! La DB métier principale (quotes, invoices, clients…) reste côté TS/Drizzle ;
//! ce module se limite au pilier atomicité numérique et au stockage binaire.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use parking_lot::Mutex;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Debug, thiserror::Error)]
pub enum FaktError {
    #[error("sqlite: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("state: {0}")]
    State(String),
    #[error("validation: {0}")]
    Validation(String),
}

pub type FaktResult<T> = Result<T, FaktError>;

impl serde::Serialize for FaktError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

/// Conteneur global pour l'état runtime FAKT.
///
/// Note : à partir de Track η, les `SignatureEvent` ne sont plus mis en cache
/// en RAM ici — ils sont persistés en SQLite via l'api-server sidecar (POST
/// /api/signature-events). Cf. `docs/sprint-notes/e2e-wiring-audit.md` §6.2.
#[derive(Debug)]
pub struct AppState {
    pub db_path: PathBuf,
    pub numbering_db: Mutex<Option<Connection>>,
    pub setup_flag: Mutex<bool>,
    pub signed_pdfs: Mutex<HashMap<(String, String), PathBuf>>,
    pub signed_dir: PathBuf,
}

impl AppState {
    pub fn new(app_data_dir: &Path) -> FaktResult<Arc<Self>> {
        std::fs::create_dir_all(app_data_dir)?;
        let db_path = app_data_dir.join("numbering.sqlite");
        let signed_dir = app_data_dir.join("signed");
        std::fs::create_dir_all(&signed_dir)?;

        let conn = Connection::open(&db_path)?;
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS numbering_state (
                workspace_id TEXT NOT NULL,
                year INTEGER NOT NULL,
                type TEXT NOT NULL CHECK (type IN ('quote','invoice')),
                last_sequence INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (workspace_id, year, type)
            );
            CREATE TABLE IF NOT EXISTS setup_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                completed_at INTEGER
            );
            INSERT OR IGNORE INTO setup_state (id, completed_at) VALUES (1, NULL);
            "#,
        )?;

        let setup_flag = conn
            .query_row(
                "SELECT completed_at IS NOT NULL FROM setup_state WHERE id = 1",
                [],
                |r| r.get::<_, i64>(0).map(|v| v != 0),
            )
            .unwrap_or(false);

        Ok(Arc::new(Self {
            db_path,
            numbering_db: Mutex::new(Some(conn)),
            setup_flag: Mutex::new(setup_flag),
            signed_pdfs: Mutex::new(HashMap::new()),
            signed_dir,
        }))
    }

    pub fn next_sequence(
        &self,
        workspace_id: &str,
        year: i32,
        doc_type: &str,
    ) -> FaktResult<i64> {
        if doc_type != "quote" && doc_type != "invoice" {
            return Err(FaktError::Validation(format!(
                "doc_type invalide: {}",
                doc_type
            )));
        }
        let mut guard = self.numbering_db.lock();
        let conn = guard
            .as_mut()
            .ok_or_else(|| FaktError::State("DB non initialisée".into()))?;
        let tx = conn.transaction_with_behavior(
            rusqlite::TransactionBehavior::Immediate,
        )?;
        let current: Option<i64> = tx
            .query_row(
                "SELECT last_sequence FROM numbering_state
                 WHERE workspace_id = ?1 AND year = ?2 AND type = ?3",
                params![workspace_id, year, doc_type],
                |r| r.get(0),
            )
            .ok();
        let next = current.unwrap_or(0) + 1;
        tx.execute(
            "INSERT INTO numbering_state (workspace_id, year, type, last_sequence)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(workspace_id, year, type)
             DO UPDATE SET last_sequence = excluded.last_sequence",
            params![workspace_id, year, doc_type, next],
        )?;
        tx.commit()?;
        Ok(next)
    }

    pub fn mark_setup_completed(&self) -> FaktResult<()> {
        let mut guard = self.numbering_db.lock();
        let conn = guard
            .as_mut()
            .ok_or_else(|| FaktError::State("DB non initialisée".into()))?;
        let now: i64 = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);
        conn.execute(
            "UPDATE setup_state SET completed_at = ?1 WHERE id = 1",
            params![now],
        )?;
        *self.setup_flag.lock() = true;
        Ok(())
    }

    pub fn is_setup_completed(&self) -> bool {
        *self.setup_flag.lock()
    }

    pub fn store_signed_pdf(
        &self,
        doc_type: &str,
        doc_id: &str,
        bytes: &[u8],
    ) -> FaktResult<PathBuf> {
        let filename = format!("{}-{}.pdf", doc_type, doc_id);
        let path = self.signed_dir.join(filename);
        std::fs::write(&path, bytes)?;
        self.signed_pdfs
            .lock()
            .insert((doc_type.to_string(), doc_id.to_string()), path.clone());
        Ok(path)
    }

    pub fn load_signed_pdf(
        &self,
        doc_type: &str,
        doc_id: &str,
    ) -> FaktResult<Option<Vec<u8>>> {
        let map = self.signed_pdfs.lock();
        if let Some(p) = map.get(&(doc_type.to_string(), doc_id.to_string())) {
            return Ok(Some(std::fs::read(p)?));
        }
        let candidate = self.signed_dir.join(format!("{}-{}.pdf", doc_type, doc_id));
        if candidate.exists() {
            return Ok(Some(std::fs::read(&candidate)?));
        }
        Ok(None)
    }

}

/// Payload léger retourné par numbering_next_quote / numbering_next_invoice.
#[derive(Debug, Serialize, Deserialize)]
pub struct NumberingPayload {
    pub year: i32,
    pub sequence: i64,
    pub formatted: String,
}

pub fn format_quote_number(year: i32, seq: i64) -> String {
    format!("D{:04}-{:03}", year, seq)
}

pub fn format_invoice_number(year: i32, seq: i64) -> String {
    format!("F{:04}-{:03}", year, seq)
}
