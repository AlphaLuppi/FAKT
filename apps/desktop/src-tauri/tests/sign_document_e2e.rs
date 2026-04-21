//! Test d'intégration D3 — orchestration D1+D2+D3 sign_document.
//!
//! Ce test ne passe PAS par la Tauri command (qui nécessite un AppHandle) — il
//! reproduit la logique d'orchestration avec les modules publics pour valider :
//! - Chain audit : 2 signatures consécutives → `previous_event_hash` cohérent.
//! - Embed PAdES-B fonctionne en mode `skip_tsa` (offline).
//!
//! Le round-trip TSA live est testé par `crypto::tsa::tests::live_freetsa_roundtrip`
//! (ignore par défaut) sur OS avec connectivité.

use std::fs;
use std::path::PathBuf;

use der::Encode;
use fakt_lib::crypto::audit::{self, verify_chain, SignatureEvent};
use fakt_lib::crypto::cert::{generate_self_signed_cert, SubjectDn};
use fakt_lib::crypto::pades::embed_signature_with_timestamp;
use fakt_lib::crypto::tsa;

fn out_dir() -> PathBuf {
    let here = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let out = here.join("tests").join("output");
    fs::create_dir_all(&out).unwrap();
    out
}

fn minimal_pdf(text: &str) -> Vec<u8> {
    use lopdf::{dictionary, Document, Object, Stream};

    let mut doc = Document::with_version("1.4");
    let font_id = doc.add_object(dictionary! {
        "Type" => "Font",
        "Subtype" => "Type1",
        "BaseFont" => "Helvetica",
    });
    let content = format!("BT /F1 24 Tf 100 700 Td ({}) Tj ET", text).into_bytes();
    let content_id = doc.add_object(Stream::new(dictionary! {}, content));
    let resources = dictionary! { "Font" => dictionary! { "F1" => font_id } };
    let page_id = doc.new_object_id();
    let pages_id = doc.add_object(dictionary! {
        "Type" => "Pages",
        "Kids" => vec![Object::Reference(page_id)],
        "Count" => 1,
    });
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
    let catalog_id = doc.add_object(dictionary! {
        "Type" => "Catalog",
        "Pages" => pages_id,
    });
    doc.trailer.set("Root", catalog_id);
    let mut buf = Vec::new();
    doc.save_to(&mut buf).unwrap();
    buf
}

fn sample_dn() -> SubjectDn {
    SubjectDn {
        common_name: "Tom Andrieu".to_string(),
        organization: Some("AlphaLuppi".to_string()),
        country: "FR".to_string(),
        email: Some("contact@alphaluppi.com".to_string()),
    }
}

#[test]
fn orchestration_pades_b_offline_with_audit_chain() {
    // Génération cert unique pour les 2 signatures.
    let gen = generate_self_signed_cert(&sample_dn()).expect("cert gen");

    // --- Signature 1 ---
    let pdf1 = minimal_pdf("Facture INV-2026-0001");
    let signed1 = embed_signature_with_timestamp(
        &pdf1,
        &gen.x509_der,
        &gen.rsa_priv_pkcs8_der,
        b"png1",
        None, // skip TSA
    )
    .expect("embed1");

    let event1 = SignatureEvent {
        id: "evt-1".to_string(),
        document_type: "invoice".to_string(),
        document_id: "INV-2026-0001".to_string(),
        signer_name: "Tom Andrieu".to_string(),
        signer_email: "contact@alphaluppi.com".to_string(),
        ip_address: None,
        user_agent: None,
        timestamp_iso: "2026-04-21T19:40:00Z".to_string(),
        doc_hash_before: hex::encode(signed1.doc_hash_before_sha256),
        doc_hash_after: hex::encode(signed1.doc_hash_after_sha256),
        signature_png_base64: None,
        tsa_provider: None,
        tsa_response_base64: None,
        previous_event_hash: audit::compute_previous_hash(None),
    };

    // --- Signature 2 ---
    let pdf2 = minimal_pdf("Facture INV-2026-0002");
    let signed2 = embed_signature_with_timestamp(
        &pdf2,
        &gen.x509_der,
        &gen.rsa_priv_pkcs8_der,
        b"png2",
        None,
    )
    .expect("embed2");

    let event2 = SignatureEvent {
        id: "evt-2".to_string(),
        document_type: "invoice".to_string(),
        document_id: "INV-2026-0002".to_string(),
        signer_name: "Tom Andrieu".to_string(),
        signer_email: "contact@alphaluppi.com".to_string(),
        ip_address: None,
        user_agent: None,
        timestamp_iso: "2026-04-21T19:45:00Z".to_string(),
        doc_hash_before: hex::encode(signed2.doc_hash_before_sha256),
        doc_hash_after: hex::encode(signed2.doc_hash_after_sha256),
        signature_png_base64: None,
        tsa_provider: None,
        tsa_response_base64: None,
        previous_event_hash: audit::compute_previous_hash(Some(&event1)),
    };

    // Vérifier chaîne cohérente.
    let events = vec![event1.clone(), event2.clone()];
    let broken = verify_chain(&events);
    assert!(broken.is_empty(), "chain should be valid");

    // Tamper : si on modifie event1 après coup, chain doit casser sur index 1.
    let mut event1_tampered = event1.clone();
    event1_tampered.doc_hash_after = "0".repeat(64);
    let bad_chain = vec![event1_tampered, event2.clone()];
    let broken = verify_chain(&bad_chain);
    assert_eq!(broken, vec![1]);

    // Écrire PDFs signés.
    fs::write(out_dir().join("signed_invoice_1.pdf"), &signed1.pdf_bytes).unwrap();
    fs::write(out_dir().join("signed_invoice_2.pdf"), &signed2.pdf_bytes).unwrap();
}

#[test]
fn tsa_tsq_format_is_parseable() {
    let digest = [0x42u8; 32];
    let tsq = tsa::build_timestamp_query(&digest).expect("tsq");
    // Vérifie que c'est une SEQUENCE DER bien formée.
    assert_eq!(tsq[0], 0x30);
    // Le hash SHA-256 OID doit apparaître dans le TSQ.
    let sha256_oid_der = [0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01];
    assert!(
        tsq.windows(sha256_oid_der.len()).any(|w| w == sha256_oid_der),
        "SHA-256 OID not found in TSQ"
    );
}

/// E2E test réseau : full PAdES-B-T avec vrai TSR FreeTSA.
#[test]
#[ignore = "live network: requires FreeTSA reachable"]
fn full_pades_b_t_with_live_freetsa() {
    let gen = generate_self_signed_cert(&sample_dn()).expect("cert");
    let pdf = minimal_pdf("Facture avec TSR live FreeTSA");

    // 1. Embed PAdES-B d'abord pour obtenir la signature RSA.
    let signed_b = embed_signature_with_timestamp(
        &pdf,
        &gen.x509_der,
        &gen.rsa_priv_pkcs8_der,
        b"png",
        None,
    )
    .expect("embed B");

    // 2. Extract la signature RSA du CMS (SignerInfo.signature).
    use cms::content_info::ContentInfo;
    use cms::signed_data::SignedData;
    use der::Decode;
    use sha2::{Digest, Sha256};

    let ci = ContentInfo::from_der(&signed_b.cms_der).expect("ci");
    let sd: SignedData = ci.content.decode_as().expect("sd");
    let si = sd.signer_infos.0.as_slice().first().expect("si");
    let sig_bytes = si.signature.as_bytes();

    let mut h = Sha256::new();
    h.update(sig_bytes);
    let digest: [u8; 32] = h.finalize().into();

    // 3. TSA round-trip.
    let token = tsa::request_timestamp(&digest, &[tsa::FREETSA_URL])
        .expect("FreeTSA timestamp");
    println!("TSR from {}: {} bytes", token.provider_url, token.tst_der.len());

    // 4. Re-embed avec TSR → PAdES-B-T.
    let signed_bt = embed_signature_with_timestamp(
        &pdf,
        &gen.x509_der,
        &gen.rsa_priv_pkcs8_der,
        b"png",
        Some(&token.tst_der),
    )
    .expect("embed B-T");

    fs::write(
        out_dir().join("signed_pades_b_t_freetsa.pdf"),
        &signed_bt.pdf_bytes,
    )
    .unwrap();

    // Vérifier que le TSR est dans le CMS (OID id-smime-aa-timeStampToken).
    let tst_oid_der = [
        0x06, 0x0B, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x09, 0x10, 0x02, 0x0E,
    ];
    assert!(
        signed_bt
            .cms_der
            .windows(tst_oid_der.len())
            .any(|w| w == tst_oid_der),
        "TST OID missing in final CMS"
    );
}

#[test]
fn pades_bt_with_fake_tsr_passes_embed() {
    // Construit un "fake" TSR minimal (SEQUENCE avec un dummy INTEGER) juste
    // pour vérifier que l'embed avec tsr_der Some() ne crashe pas.
    use der::{asn1::Int, Sequence};

    #[derive(Sequence)]
    struct FakeTsr {
        version: Int,
    }

    let fake = FakeTsr {
        version: Int::new(&[1u8]).unwrap(),
    };
    let fake_der = fake.to_der().unwrap();

    let gen = generate_self_signed_cert(&sample_dn()).expect("cert");
    let pdf = minimal_pdf("avec TSR fake");
    let signed = embed_signature_with_timestamp(
        &pdf,
        &gen.x509_der,
        &gen.rsa_priv_pkcs8_der,
        b"png",
        Some(&fake_der),
    )
    .expect("embed with fake tsr");

    // Parseable en lopdf.
    let _ = lopdf::Document::load_mem(&signed.pdf_bytes).expect("valid pdf");

    // Le CMS contient l'UnsignedAttribute `id-smime-aa-timeStampToken`
    // (OID 1.2.840.113549.1.9.16.2.14 = DER 06 0B 2A 86 48 86 F7 0D 01 09 10 02 0E).
    let tst_oid_der = [
        0x06, 0x0B, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x09, 0x10, 0x02, 0x0E,
    ];
    assert!(
        signed
            .cms_der
            .windows(tst_oid_der.len())
            .any(|w| w == tst_oid_der),
        "id-smime-aa-timeStampToken OID not found in CMS (PAdES-B-T missing TSR attribute)"
    );
}
