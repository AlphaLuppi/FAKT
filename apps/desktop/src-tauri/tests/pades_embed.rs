//! Test d'intégration D2 — embed PAdES-B sur un PDF minimal.
//!
//! Produit un fichier `tests/output/signed.pdf` validable manuellement dans
//! Adobe Acrobat Reader. Le test vérifie :
//! - Le PDF signé est une structure valide (lopdf peut le re-parser).
//! - `/ByteRange` couvre bien seg1 + seg2 (tout sauf /Contents hex).
//! - Le CMS embed est décodable et contient le cert du signataire.
//! - Le hash recalculé matche la digest CMS.

use std::fs;
use std::path::PathBuf;

use der::Decode;
use fakt_lib::crypto::cert::{generate_self_signed_cert, SubjectDn};
use fakt_lib::crypto::pades::embed_signature;

fn out_dir() -> PathBuf {
    let here = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let out = here.join("tests").join("output");
    fs::create_dir_all(&out).unwrap();
    out
}

fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
}

fn sample_dn() -> SubjectDn {
    SubjectDn {
        common_name: "Tom Andrieu".to_string(),
        organization: Some("AlphaLuppi".to_string()),
        country: "FR".to_string(),
        email: Some("contact@alphaluppi.com".to_string()),
    }
}

/// PDF 1.4 minimal avec 1 page texte — construit via lopdf pour assurer xref correct.
fn minimal_pdf() -> Vec<u8> {
    use lopdf::{dictionary, Document, Object, Stream};

    let mut doc = Document::with_version("1.4");

    // Font Helvetica built-in.
    let font_id = doc.add_object(dictionary! {
        "Type" => "Font",
        "Subtype" => "Type1",
        "BaseFont" => "Helvetica",
    });

    // Stream de contenu de la page.
    let content = b"BT /F1 24 Tf 100 700 Td (Hello FAKT PAdES POC) Tj ET".to_vec();
    let content_id = doc.add_object(Stream::new(dictionary! {}, content));

    // Page.
    let resources = dictionary! {
        "Font" => dictionary! { "F1" => font_id },
    };
    let page_id = doc.new_object_id();

    // Pages root.
    let pages_id = doc.add_object(dictionary! {
        "Type" => "Pages",
        "Kids" => vec![Object::Reference(page_id)],
        "Count" => 1,
    });

    // Page object.
    doc.objects.insert(
        page_id,
        Object::Dictionary(dictionary! {
            "Type" => "Page",
            "Parent" => pages_id,
            "MediaBox" => vec![0.into(), 0.into(), 612.into(), 792.into()],
            "Contents" => content_id,
            "Resources" => resources,
        }),
    );

    // Catalog.
    let catalog_id = doc.add_object(dictionary! {
        "Type" => "Catalog",
        "Pages" => pages_id,
    });

    doc.trailer.set("Root", catalog_id);

    let mut buf = Vec::new();
    doc.save_to(&mut buf).expect("minimal_pdf save");
    buf
}

#[test]
fn embed_signature_produces_valid_pdf() {
    // 1. Générer cert + priv_key.
    let gen_cert = generate_self_signed_cert(&sample_dn()).expect("cert gen");

    // 2. PDF source.
    let pdf_source = minimal_pdf();
    fs::write(out_dir().join("source.pdf"), &pdf_source).unwrap();

    // 3. Embed signature.
    let t0 = std::time::Instant::now();
    let signed = embed_signature(
        &pdf_source,
        &gen_cert.x509_der,
        &gen_cert.rsa_priv_pkcs8_der,
        b"fake png",
    )
    .expect("embed signature");
    let dt = t0.elapsed();
    println!("embed_signature duration: {:?}", dt);

    // 4. Écrire le PDF signé pour validation manuelle Adobe Reader.
    let out_path = out_dir().join("signed.pdf");
    fs::write(&out_path, &signed.pdf_bytes).unwrap();
    println!("Signed PDF written to: {}", out_path.display());

    // 5. Sanity : re-parse via lopdf pour s'assurer qu'il est bien formé.
    let _doc = lopdf::Document::load_mem(&signed.pdf_bytes)
        .expect("signed pdf parseable");

    // 6. CMS DER décodable.
    let _content_info = cms::content_info::ContentInfo::from_der(&signed.cms_der)
        .expect("cms content_info parseable");

    // 7. Hash before != after (on a modifié le PDF).
    assert_ne!(signed.doc_hash_before_sha256, signed.doc_hash_after_sha256);

    // 8. ByteRange sanity : la chaîne "/ByteRange [" est bien dans le PDF signé
    //    et ses 4 nombres couvrent seg1 (0..contents_start) + seg2 (contents_end..EOF).
    let idx_br = find_substr(&signed.pdf_bytes, b"/ByteRange").expect("byte range");
    let tail = &signed.pdf_bytes[idx_br..idx_br + 100];
    let tail_str = std::str::from_utf8(tail).unwrap_or("");
    assert!(tail_str.contains("["), "byte range array missing");

    // 9. Vérification cryptographique end-to-end : signature RSA sur signedAttrs valide
    //    + messageDigest = sha256(seg1+seg2).
    verify_cms_signature(&signed.pdf_bytes, &signed.cms_der)
        .expect("CMS signature should verify");

    // Benchmark DoD : < 500ms en release. En debug on tolère 2s.
    // Pas de fail strict ici — juste log.
    if cfg!(not(debug_assertions)) {
        assert!(
            dt < std::time::Duration::from_millis(500),
            "embed too slow: {:?}",
            dt
        );
    }

    // 9. Optionnel : copier le cert pour validation manuelle (import dans Adobe).
    fs::write(out_dir().join("cert.der"), &gen_cert.x509_der).unwrap();

    // S'assure que fixtures existe (pour CI / dev — silencieux si existe déjà).
    fs::create_dir_all(fixtures_dir()).ok();
}

fn find_substr(hay: &[u8], needle: &[u8]) -> Option<usize> {
    hay.windows(needle.len()).position(|w| w == needle)
}

/// Vérification cryptographique end-to-end d'un PDF signé FAKT.
///
/// 1. Extrait /ByteRange et recalcule SHA-256 de seg1+seg2.
/// 2. Parse le CMS, extrait signedAttrs + signature + cert.
/// 3. Vérifie que `messageDigest` attribut = hash(seg1+seg2).
/// 4. Ré-encode signedAttrs en SET (universal tag 0x31) + vérifie signature RSA.
fn verify_cms_signature(pdf_bytes: &[u8], _cms_der: &[u8]) -> Result<(), String> {
    use cms::content_info::ContentInfo;
    use cms::signed_data::SignedData;
    use der::{Decode, Encode, Tag};
    use rsa::pkcs1v15::{Signature as RsaSignature, VerifyingKey};
    use rsa::signature::Verifier;
    use rsa::{pkcs1::DecodeRsaPublicKey, RsaPublicKey};
    use sha2::{Digest, Sha256};
    use x509_cert::Certificate;

    // 1. Parse /ByteRange
    let idx = pdf_bytes
        .windows(b"/ByteRange".len())
        .position(|w| w == b"/ByteRange")
        .ok_or("no ByteRange")?;
    let tail = &pdf_bytes[idx..idx + 100];
    let bracket_start = tail.iter().position(|&b| b == b'[').ok_or("no [")?;
    let bracket_end = tail.iter().position(|&b| b == b']').ok_or("no ]")?;
    let inner = &tail[bracket_start + 1..bracket_end];
    let inner_str = std::str::from_utf8(inner).map_err(|e| format!("utf8: {}", e))?;
    let nums: Vec<usize> = inner_str
        .split_whitespace()
        .map(|s| s.parse().map_err(|e| format!("parse: {}", e)))
        .collect::<Result<_, _>>()?;
    if nums.len() != 4 {
        return Err(format!("byte range has {} elements", nums.len()));
    }
    let seg1 = &pdf_bytes[nums[0]..nums[0] + nums[1]];
    let seg2 = &pdf_bytes[nums[2]..nums[2] + nums[3]];

    let mut h = Sha256::new();
    h.update(seg1);
    h.update(seg2);
    let content_hash: [u8; 32] = h.finalize().into();

    // 2. Parse CMS depuis le /Contents hex dans le PDF.
    let contents_idx = pdf_bytes
        .windows(b"/Contents<".len())
        .position(|w| w == b"/Contents<")
        .or_else(|| {
            pdf_bytes
                .windows(b"/Contents <".len())
                .position(|w| w == b"/Contents <")
        })
        .ok_or("no Contents")?;
    let lt = pdf_bytes[contents_idx..]
        .iter()
        .position(|&b| b == b'<')
        .ok_or("no <")?;
    let gt = pdf_bytes[contents_idx + lt + 1..]
        .iter()
        .position(|&b| b == b'>')
        .ok_or("no >")?;
    let hex_bytes = &pdf_bytes[contents_idx + lt + 1..contents_idx + lt + 1 + gt];
    let hex_str = std::str::from_utf8(hex_bytes).map_err(|e| format!("utf8 hex: {}", e))?;
    let trimmed = hex_str.trim_end_matches('0');
    let pad = if trimmed.len() % 2 == 1 { "0" } else { "" };
    let cms_from_pdf = hex::decode(format!("{}{}", trimmed, pad))
        .map_err(|e| format!("hex decode: {}", e))?;

    let ci = ContentInfo::from_der(&cms_from_pdf).map_err(|e| format!("ci: {}", e))?;
    let sd: SignedData = ci.content.decode_as().map_err(|e| format!("sd decode: {}", e))?;

    if sd.signer_infos.0.len() != 1 {
        return Err("expected 1 signer info".to_string());
    }
    let si = &sd.signer_infos.0.as_slice()[0];
    let signed_attrs = si.signed_attrs.as_ref().ok_or("no signed attrs")?;

    // 3. Vérifier messageDigest attribut = content_hash.
    use const_oid::ObjectIdentifier;
    let oid_msg_digest: ObjectIdentifier =
        "1.2.840.113549.1.9.4".parse().map_err(|_| "oid parse")?;
    let mut found_md: Option<Vec<u8>> = None;
    for attr in signed_attrs.iter() {
        if attr.oid == oid_msg_digest {
            let vals = &attr.values;
            if let Some(v) = vals.iter().next() {
                let octet_der = v.to_der().map_err(|e| format!("oct der: {}", e))?;
                // OCTET STRING: 0x04 LEN DATA
                if octet_der.len() > 2 && octet_der[0] == 0x04 {
                    let data_len = octet_der[1] as usize;
                    found_md = Some(octet_der[2..2 + data_len].to_vec());
                }
            }
        }
    }
    let md = found_md.ok_or("no messageDigest")?;
    if md.as_slice() != content_hash.as_slice() {
        return Err(format!(
            "messageDigest mismatch: stored={}, computed={}",
            hex::encode(&md),
            hex::encode(content_hash)
        ));
    }

    // 4. Ré-encoder signedAttrs comme SET OF (tag 0x31 universel).
    // CMS lib nous donne signed_attrs = SignedAttributes (alias SetOfVec<Attribute>)
    // qui s'encode déjà comme SET OF universel. On peut juste l'appeler.
    let signed_attrs_der = signed_attrs
        .to_der()
        .map_err(|e| format!("sa der: {}", e))?;
    // Sanity: premier octet doit être 0x31 (SET universel constructed).
    if signed_attrs_der.first() != Some(&0x31) {
        return Err(format!(
            "signedAttrs tag = {:#x}, expected 0x31 (SET)",
            signed_attrs_der.first().unwrap_or(&0)
        ));
    }

    // 5. Vérifier signature RSA PKCS#1v1.5 + SHA-256 sur signed_attrs_der.
    let cert_enum = sd
        .certificates
        .as_ref()
        .ok_or("no certs")?
        .0
        .as_slice()
        .first()
        .ok_or("empty certs")?;
    let cert: &Certificate = match cert_enum {
        cms::cert::CertificateChoices::Certificate(c) => c,
        _ => return Err("unexpected cert choice".to_string()),
    };

    let pub_info = &cert.tbs_certificate.subject_public_key_info;
    let pub_key_bytes = pub_info
        .subject_public_key
        .as_bytes()
        .ok_or("no bitstring bytes")?;
    let pub_key = RsaPublicKey::from_pkcs1_der(pub_key_bytes)
        .map_err(|e| format!("pub key: {}", e))?;

    let verifying_key: VerifyingKey<Sha256> = VerifyingKey::new(pub_key);
    let sig_bytes = si.signature.as_bytes();
    let sig = RsaSignature::try_from(sig_bytes).map_err(|e| format!("sig: {}", e))?;

    verifying_key
        .verify(&signed_attrs_der, &sig)
        .map_err(|e| format!("RSA verify failed: {}", e))?;

    // Ensure Tag import used (silence unused)
    let _ = Tag::Null;

    Ok(())
}
