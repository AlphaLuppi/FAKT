//! Embed PAdES B-T — stub à compléter en Sub-track D2.
#![allow(dead_code)]

use crate::crypto::error::CryptoResult;

pub fn embed_signature(
    _pdf_bytes: &[u8],
    _cert_der: &[u8],
    _priv_key_der: &[u8],
    _signature_png: &[u8],
) -> CryptoResult<Vec<u8>> {
    unimplemented!("Track D2 — voir sub-track PAdES B-T embed")
}
