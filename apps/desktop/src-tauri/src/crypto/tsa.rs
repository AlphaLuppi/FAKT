//! Client TSA RFC 3161 — stub à compléter en Sub-track D3.
#![allow(dead_code)]

use crate::crypto::error::CryptoResult;

pub fn request_timestamp(_digest: &[u8]) -> CryptoResult<Vec<u8>> {
    unimplemented!("Track D3 — voir sub-track TSA RFC 3161")
}
