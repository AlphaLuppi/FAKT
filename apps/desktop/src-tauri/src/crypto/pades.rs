//! Embed PAdES B(asic) dans un PDF (FR-017).
//!
//! **Flow 6 étapes** (voir architecture.md §7.3) :
//! 1. Parse le PDF original via `lopdf`.
//! 2. Ajoute un champ AcroForm `/Sig` avec widget annotation (position visible).
//! 3. Écrit un PDF intermédiaire avec placeholders pour `/ByteRange` et `/Contents`.
//! 4. Calcule le hash SHA-256 sur les 2 segments byte range exclusant `/Contents`.
//! 5. Signe le hash via RSA-PKCS#1v1.5 + SHA-256, encapsule en CMS SignedData.
//! 6. Patche le PDF : remplace placeholders `/ByteRange` et `/Contents` par les valeurs réelles.
//!
//! **Note timestamping** : ce module implémente PAdES-B (baseline). Le Sub-track
//! D3 ajoute l'UnsignedAttribute `signature-time-stamp-token` pour passer PAdES-B-T.
//! L'API `embed_signature_with_timestamp` accepte un `Option<Vec<u8>>` de TSR DER.

use std::str::FromStr;

use cms::builder::{SignedDataBuilder, SignerInfoBuilder};
use cms::cert::{CertificateChoices, IssuerAndSerialNumber};
use cms::content_info::ContentInfo;
use cms::signed_data::{EncapsulatedContentInfo, SignerIdentifier};
use der::asn1::SetOfVec;
use der::{Any, Decode, Encode};
use lopdf::{dictionary, Document, Object, ObjectId, StringFormat};
use rsa::pkcs1v15::SigningKey;
use rsa::pkcs8::DecodePrivateKey;
use rsa::RsaPrivateKey;
use sha2::{Digest, Sha256};
use x509_cert::Certificate;

use crate::crypto::error::{CryptoError, CryptoResult};

/// Taille réservée pour le blob CMS embedded (hex, donc bytes * 2).
/// 16 KiB hex = 8 KiB de CMS binaire — suffisant pour une signature RSA 4096 + cert self-signed.
/// PAdES-B-T avec TSR embed : prévoir 32 KiB hex = 16 KiB binaire (TSR moyenne 5-8 KiB).
const SIG_CONTENTS_HEX_LEN: usize = 32 * 1024;

/// Résultat complet d'une opération PAdES.
pub struct SignedPdf {
    pub pdf_bytes: Vec<u8>,
    pub doc_hash_before_sha256: [u8; 32],
    pub doc_hash_after_sha256: [u8; 32],
    pub cms_der: Vec<u8>,
}

/// Encode la signature PAdES-B dans un PDF existant (sans timestamp).
///
/// `pdf_bytes` : PDF source (non signé).
/// `cert_der` : certificat X.509 DER.
/// `priv_key_pkcs8_der` : clé privée PKCS#8 DER.
/// `signature_png` : PNG du signage manuscrit (actuellement non embarqué visuellement —
///                   prévu v0.2 via Form XObject, voir architecture.md).
///
/// # Performance
/// Budget NFR-002 : < 500 ms en release sur PDF < 1 MB.
pub fn embed_signature(
    pdf_bytes: &[u8],
    cert_der: &[u8],
    priv_key_pkcs8_der: &[u8],
    signature_png: &[u8],
) -> CryptoResult<SignedPdf> {
    embed_signature_with_timestamp(pdf_bytes, cert_der, priv_key_pkcs8_der, signature_png, None)
}

/// Encode la signature PAdES-B ou B-T selon présence de `tsr_der`.
pub fn embed_signature_with_timestamp(
    pdf_bytes: &[u8],
    cert_der: &[u8],
    priv_key_pkcs8_der: &[u8],
    _signature_png: &[u8],
    tsr_der: Option<&[u8]>,
) -> CryptoResult<SignedPdf> {
    let hash_before = sha256(pdf_bytes);

    // ---- 1. Parse PDF.
    let mut doc = Document::load_mem(pdf_bytes)
        .map_err(|e| CryptoError::PdfError(format!("load_mem: {}", e)))?;

    // ---- 2. Ajouter AcroForm + SigField avec placeholders.
    let (byte_range_placeholder, _contents_placeholder) = inject_signature_dict(&mut doc)?;

    // ---- 3. Sérialiser le PDF avec placeholders.
    let mut buf_with_placeholders: Vec<u8> = Vec::new();
    doc.save_to(&mut buf_with_placeholders)
        .map_err(|e| CryptoError::PdfError(format!("save_to: {}", e)))?;

    // ---- 4. Localiser les placeholders dans le buffer sérialisé.
    let byte_range_span =
        find_placeholder(&buf_with_placeholders, byte_range_placeholder.as_bytes())
            .ok_or_else(|| {
                CryptoError::PdfError("byte range placeholder introuvable".to_string())
            })?;

    let contents_span = find_hex_contents_span(&buf_with_placeholders).ok_or_else(|| {
        CryptoError::PdfError("contents placeholder introuvable".to_string())
    })?;

    // Segments du ByteRange : [0, contents_start, contents_end, rest_len]
    //   contents_start = offset du '<' ouvrant
    //   contents_end   = offset juste après le '>' fermant
    let seg1_start: usize = 0;
    let seg1_len = contents_span.start; // '<' inclus comme frontière ouverte
    let seg2_start = contents_span.end; // après '>' fermant
    let seg2_len = buf_with_placeholders.len() - seg2_start;

    // Construire la valeur ByteRange réelle, paddée à la même largeur que le placeholder.
    let real_byte_range = format_byte_range(seg1_start, seg1_len, seg2_start, seg2_len);
    let padded = pad_to_width(&real_byte_range, byte_range_placeholder.len());
    buf_with_placeholders[byte_range_span.start..byte_range_span.end]
        .copy_from_slice(padded.as_bytes());

    // ---- 5. Hash des 2 segments.
    let mut hasher = Sha256::new();
    hasher.update(&buf_with_placeholders[seg1_start..seg1_start + seg1_len]);
    hasher.update(&buf_with_placeholders[seg2_start..seg2_start + seg2_len]);
    let pdf_digest: [u8; 32] = hasher.finalize().into();

    // ---- 6. Signer le hash via RSA PKCS#1 v1.5 + SHA-256 dans un CMS SignedData.
    let priv_key = RsaPrivateKey::from_pkcs8_der(priv_key_pkcs8_der)
        .map_err(|e| CryptoError::DerDecode(format!("priv key pkcs8: {}", e)))?;
    let cert = Certificate::from_der(cert_der)
        .map_err(|e| CryptoError::DerDecode(format!("cert: {}", e)))?;

    let cms_der = build_signed_data_cms(&priv_key, &cert, &pdf_digest, tsr_der)?;

    if cms_der.len() * 2 > SIG_CONTENTS_HEX_LEN {
        return Err(CryptoError::CmsError(format!(
            "CMS DER trop gros : {} bytes > {} réservés",
            cms_der.len(),
            SIG_CONTENTS_HEX_LEN / 2
        )));
    }

    // ---- 7. Patch /Contents avec le CMS hex (padded avec zéros à la taille réservée).
    let mut hex_cms = hex::encode_upper(&cms_der);
    let pad_target = contents_span.end - contents_span.start - 2; // -2 pour '<' et '>'
    while hex_cms.len() < pad_target {
        hex_cms.push('0');
    }

    // Remplace contenu entre '<' et '>'.
    buf_with_placeholders[contents_span.start + 1..contents_span.end - 1]
        .copy_from_slice(hex_cms.as_bytes());

    let hash_after = sha256(&buf_with_placeholders);

    Ok(SignedPdf {
        pdf_bytes: buf_with_placeholders,
        doc_hash_before_sha256: hash_before,
        doc_hash_after_sha256: hash_after,
        cms_der,
    })
}

fn sha256(data: &[u8]) -> [u8; 32] {
    let mut h = Sha256::new();
    h.update(data);
    h.finalize().into()
}

// ===== PDF manipulation =====

fn inject_signature_dict(doc: &mut Document) -> CryptoResult<(String, ()) > {
    // Placeholder ByteRange : 4 integers dummy avec largeur décimale fixe
    // (10 chiffres ⇒ couvre PDFs jusqu'à ~10 GB). Forme sérialisée :
    // `/ByteRange [9999999999 9999999999 9999999999 9999999999]`.
    // On patchera ces integers avec les vraies valeurs en réservant la même largeur.
    let placeholder_int = 9_999_999_999_i64;
    let byte_range_array = vec![
        Object::Integer(placeholder_int),
        Object::Integer(placeholder_int),
        Object::Integer(placeholder_int),
        Object::Integer(placeholder_int),
    ];

    // Dict de signature.
    //   /Type /Sig
    //   /Filter /Adobe.PPKLite
    //   /SubFilter /adbe.pkcs7.detached
    //   /ByteRange [9999999999 ...]  (placeholder)
    //   /Contents <0000...0000>      (SIG_CONTENTS_HEX_LEN chars)
    let zeros = vec![0u8; SIG_CONTENTS_HEX_LEN / 2];

    let sig_dict = dictionary! {
        "Type" => "Sig",
        "Filter" => "Adobe.PPKLite",
        "SubFilter" => "adbe.pkcs7.detached",
        "ByteRange" => Object::Array(byte_range_array),
        "Contents" => Object::String(zeros.clone(), StringFormat::Hexadecimal),
        "M" => Object::String(pdf_date_now().into_bytes(), StringFormat::Literal),
    };

    // Valeur textuelle approximative du placeholder pour `find_placeholder`.
    // lopdf sérialise probablement `[9999999999 9999999999 9999999999 9999999999]`
    // (espaces simples).
    let byte_range_placeholder = format!(
        "[{0} {0} {0} {0}]",
        placeholder_int
    );

    let sig_id: ObjectId = doc.add_object(sig_dict);

    // Rect widget : position approximative bas-droite page 1.
    let widget_rect = vec![
        Object::Integer(400),
        Object::Integer(50),
        Object::Integer(550),
        Object::Integer(100),
    ];

    // Récupérer premier page id
    let first_page = doc
        .page_iter()
        .next()
        .ok_or_else(|| CryptoError::PdfError("PDF sans page".to_string()))?;

    let field_dict = dictionary! {
        "FT" => "Sig",
        "Type" => "Annot",
        "Subtype" => "Widget",
        "T" => Object::String(b"FAKT Signature".to_vec(), StringFormat::Literal),
        "Rect" => Object::Array(widget_rect),
        "V" => Object::Reference(sig_id),
        "P" => Object::Reference(first_page),
        "F" => Object::Integer(132), // Print + Locked
    };
    let field_id = doc.add_object(field_dict);

    // Ajouter widget annotation à la page.
    {
        let page = doc
            .get_object_mut(first_page)
            .map_err(|e| CryptoError::PdfError(format!("get page: {}", e)))?;
        let page_dict = page
            .as_dict_mut()
            .map_err(|e| CryptoError::PdfError(format!("page dict: {}", e)))?;
        let annots_key = b"Annots";
        match page_dict.get_mut(annots_key) {
            Ok(Object::Array(arr)) => arr.push(Object::Reference(field_id)),
            _ => {
                page_dict.set("Annots", vec![Object::Reference(field_id)]);
            }
        }
    }

    // Catalog → AcroForm
    {
        let root_id = doc.trailer.get(b"Root").and_then(|o| o.as_reference())
            .map_err(|e| CryptoError::PdfError(format!("root ref: {}", e)))?;
        let root = doc
            .get_object_mut(root_id)
            .map_err(|e| CryptoError::PdfError(format!("catalog: {}", e)))?;
        let root_dict = root
            .as_dict_mut()
            .map_err(|e| CryptoError::PdfError(format!("catalog dict: {}", e)))?;

        // AcroForm dict : inline plutôt qu'indirect, simplifie
        let acroform = dictionary! {
            "Fields" => vec![Object::Reference(field_id)],
            "SigFlags" => Object::Integer(3), // SignaturesExist + AppendOnly
        };
        root_dict.set("AcroForm", Object::Dictionary(acroform));
    }

    Ok((byte_range_placeholder, ()))
}

fn pdf_date_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let iso = format_pdf_date_iso(secs);
    format!("D:{}", iso)
}

fn format_pdf_date_iso(secs: u64) -> String {
    let days = secs / 86_400;
    let rem = secs % 86_400;
    let (h, m, s) = (rem / 3600, (rem % 3600) / 60, rem % 60);
    let (y, mo, d) = days_to_ymd(days as i64);
    format!(
        "{:04}{:02}{:02}{:02}{:02}{:02}Z00'00'",
        y, mo, d, h, m, s
    )
}

fn days_to_ymd(mut days: i64) -> (i32, u32, u32) {
    days += 719_468;
    let era = if days >= 0 { days } else { days - 146_096 } / 146_097;
    let doe = (days - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y as i32, m as u32, d as u32)
}

struct Span {
    start: usize,
    end: usize,
}

fn find_placeholder(haystack: &[u8], needle: &[u8]) -> Option<Span> {
    haystack
        .windows(needle.len())
        .position(|w| w == needle)
        .map(|p| Span {
            start: p,
            end: p + needle.len(),
        })
}

/// Trouve le span du placeholder `/Contents <0000...>` dans le PDF sérialisé.
///
/// On cherche la séquence `/Contents <` puis le prochain `>`.
fn find_hex_contents_span(buf: &[u8]) -> Option<Span> {
    let tag = b"/Contents<";
    let tag_spaces = b"/Contents <";
    let idx = buf
        .windows(tag.len())
        .position(|w| w == tag)
        .or_else(|| buf.windows(tag_spaces.len()).position(|w| w == tag_spaces))?;

    // Trouver le '<' ouvrant
    let lt_offset = buf[idx..].iter().position(|&b| b == b'<')?;
    let lt_abs = idx + lt_offset;
    let gt_offset = buf[lt_abs + 1..].iter().position(|&b| b == b'>')?;
    let gt_abs = lt_abs + 1 + gt_offset;

    Some(Span {
        start: lt_abs,
        end: gt_abs + 1,
    })
}

fn format_byte_range(a: usize, b: usize, c: usize, d: usize) -> String {
    format!("[{} {} {} {}]", a, b, c, d)
}

fn pad_to_width(s: &str, target: usize) -> String {
    if s.len() >= target {
        return s.to_string();
    }
    // Padding : ajouter des espaces à l'intérieur des '[' et ']' pour conserver la largeur.
    let inner = s.trim_start_matches('[').trim_end_matches(']');
    let want_inner = target - 2;
    let pad_count = want_inner - inner.len();
    format!("[{}{}]", inner, " ".repeat(pad_count))
}

// ===== CMS =====

fn build_signed_data_cms(
    priv_key: &RsaPrivateKey,
    cert: &Certificate,
    pdf_digest: &[u8; 32],
    tsr_der: Option<&[u8]>,
) -> CryptoResult<Vec<u8>> {
    use const_oid::db::rfc5911::ID_DATA;
    use const_oid::db::rfc5912::ID_SHA_256;

    let digest_alg = spki::AlgorithmIdentifierOwned {
        oid: ID_SHA_256,
        parameters: None,
    };

    // PAdES detached : encapContentInfo sans eContent.
    let encap = EncapsulatedContentInfo {
        econtent_type: ID_DATA,
        econtent: None,
    };

    let signer_id = SignerIdentifier::IssuerAndSerialNumber(IssuerAndSerialNumber {
        issuer: cert.tbs_certificate.issuer.clone(),
        serial_number: cert.tbs_certificate.serial_number.clone(),
    });

    let signing_key: SigningKey<Sha256> = SigningKey::new(priv_key.clone());

    let mut signer_info_builder = SignerInfoBuilder::new(
        &signing_key,
        signer_id,
        digest_alg.clone(),
        &encap,
        Some(pdf_digest.as_slice()),
    )
    .map_err(|e| CryptoError::CmsError(format!("signer info new: {}", e)))?;

    // Signature TSA timestamp comme UnsignedAttribute (PAdES-B-T).
    if let Some(tsr) = tsr_der {
        use const_oid::ObjectIdentifier;
        use x509_cert::attr::{Attribute, AttributeValue};

        let oid_ts_token = ObjectIdentifier::from_str("1.2.840.113549.1.9.16.2.14")
            .map_err(|e| CryptoError::CmsError(format!("oid ts_token: {}", e)))?;

        // TSR est le TimeStampToken complet (ContentInfo CMS). On l'embedde tel quel.
        let tsr_any = Any::from_der(tsr)
            .map_err(|e| CryptoError::CmsError(format!("tsr der: {}", e)))?;
        let mut values = SetOfVec::<AttributeValue>::new();
        values
            .insert(tsr_any)
            .map_err(|e| CryptoError::CmsError(format!("tsr insert: {}", e)))?;

        let attr = Attribute {
            oid: oid_ts_token,
            values,
        };
        signer_info_builder
            .add_unsigned_attribute(attr)
            .map_err(|e| CryptoError::CmsError(format!("add tsr attr: {}", e)))?;
    }

    let mut builder = SignedDataBuilder::new(&encap);
    builder
        .add_digest_algorithm(digest_alg)
        .map_err(|e| CryptoError::CmsError(format!("add digest algo: {}", e)))?;

    // Ajoute le cert du signataire.
    builder
        .add_certificate(CertificateChoices::Certificate(cert.clone()))
        .map_err(|e| CryptoError::CmsError(format!("add cert: {}", e)))?;

    builder
        .add_signer_info::<SigningKey<Sha256>, rsa::pkcs1v15::Signature>(signer_info_builder)
        .map_err(|e| CryptoError::CmsError(format!("add signer: {}", e)))?;

    let content_info: ContentInfo = builder
        .build()
        .map_err(|e| CryptoError::CmsError(format!("build: {}", e)))?;

    let der = content_info
        .to_der()
        .map_err(|e| CryptoError::DerEncode(format!("content_info: {}", e)))?;

    Ok(der)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn placeholder_finder() {
        let buf = b"hello /ByteRange [                ] world";
        let span = find_placeholder(buf, b"[                ]").unwrap();
        assert_eq!(&buf[span.start..span.end], b"[                ]");
    }

    #[test]
    fn hex_contents_finder_both_forms() {
        let buf1 = b"... /Contents<0000>  rest";
        let s1 = find_hex_contents_span(buf1).unwrap();
        assert_eq!(&buf1[s1.start..s1.end], b"<0000>");

        let buf2 = b"... /Contents <ABCDEF>  rest";
        let s2 = find_hex_contents_span(buf2).unwrap();
        assert_eq!(&buf2[s2.start..s2.end], b"<ABCDEF>");
    }

    #[test]
    fn byte_range_padding() {
        let real = format_byte_range(0, 100, 16484, 1234);
        let padded = pad_to_width(&real, 42);
        assert_eq!(padded.len(), 42);
        assert!(padded.starts_with('['));
        assert!(padded.ends_with(']'));
    }
}
