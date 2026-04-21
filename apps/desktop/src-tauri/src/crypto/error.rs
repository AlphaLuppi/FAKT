//! Erreurs unifiées du module crypto.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum CryptoError {
    #[error("échec génération clé RSA : {0}")]
    RsaKeyGen(String),

    #[error("échec construction certificat X.509 : {0}")]
    CertBuild(String),

    #[error("échec encodage DER : {0}")]
    DerEncode(String),

    #[error("échec décodage DER : {0}")]
    DerDecode(String),

    #[error("clé non trouvée dans le keychain ({0})")]
    KeyNotFound(String),

    #[error("keychain OS indisponible : {0}")]
    KeychainUnavailable(String),

    #[error("fallback AES-GCM : {0}")]
    FallbackError(String),

    #[error("erreur PDF : {0}")]
    PdfError(String),

    #[error("erreur CMS/PKCS#7 : {0}")]
    CmsError(String),

    #[error("TSA : {0}")]
    TsaError(String),

    #[error("audit trail : {0}")]
    AuditError(String),

    #[error("signature : {0}")]
    SignError(String),

    #[error("i/o : {0}")]
    Io(#[from] std::io::Error),

    #[error("base64 : {0}")]
    Base64(#[from] base64::DecodeError),

    #[error("hex : {0}")]
    Hex(#[from] hex::FromHexError),
}

impl serde::Serialize for CryptoError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type CryptoResult<T> = std::result::Result<T, CryptoError>;
