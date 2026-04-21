//! Audit trail chaîné SHA-256 — stub à compléter en Sub-track D3.
#![allow(dead_code)]

use crate::crypto::error::CryptoResult;

pub fn append_signature_event(_prev_hash: [u8; 32], _event_data: &[u8]) -> CryptoResult<[u8; 32]> {
    unimplemented!("Track D3 — voir sub-track Audit trail chaîné")
}
