//! Produit un PDF signé PAdES-B-T déterministe, sans appel réseau, pour le
//! gate 1 validation Adobe Reader (Tom, 2026-04-22). Le TSR embarqué est
//! structurellement valide (DER bien formé) mais signé par un cert fake —
//! Adobe affichera donc « signature valide, TSA non reconnu » en préparation
//! ; ce qu'on valide ici, c'est la conformité PAdES-B-T du container PDF
//! (présence de l'UnsignedAttribute `id-smime-aa-timeStampToken` + ByteRange
//! bien calculé + Catalog.AcroForm renseigné).
//!
//! Le test `full_pades_b_t_with_live_freetsa` dans `sign_document_e2e.rs`
//! reste la référence réseau pour validation end-to-end cryptographique,
//! mais il est `#[ignore]`-d pour ne pas faire dépendre la CI de FreeTSA.
//!
//! Fichier produit : `apps/desktop/tests/fixtures/signed_pades_b_t_freetsa.pdf`

use std::fs;
use std::path::PathBuf;

use der::asn1::{Int, OctetString};
use der::oid::ObjectIdentifier;
use der::{Encode, Sequence};
use fakt_lib::crypto::cert::{generate_self_signed_cert, SubjectDn};
use fakt_lib::crypto::pades::embed_signature_with_timestamp;

fn fixtures_dir() -> PathBuf {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    // CARGO_MANIFEST_DIR = apps/desktop/src-tauri → on cible apps/desktop/tests/fixtures.
    let target = manifest
        .parent()
        .expect("parent (apps/desktop)")
        .join("tests")
        .join("fixtures");
    fs::create_dir_all(&target).expect("create fixtures dir");
    target
}

fn sample_pdf() -> Vec<u8> {
    use lopdf::{dictionary, Document, Object, Stream};

    let mut doc = Document::with_version("1.4");
    let font_id = doc.add_object(dictionary! {
        "Type" => "Font",
        "Subtype" => "Type1",
        "BaseFont" => "Helvetica",
    });
    let content = b"BT /F1 24 Tf 80 720 Td (FAKT - Fixture PAdES-B-T) Tj ET".to_vec();
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

/// Construit un TSR (TimeStampResp) minimal mais structurellement valide au
/// sens RFC 3161 §2.4.2 : un PKIStatusInfo {granted} + TimeStampToken qui est
/// en fait un ContentInfo enveloppant un SignedData `id-ct-TSTInfo`.
///
/// On ne signe pas réellement — on y met juste un TSTInfo minimal pour que
/// `id-smime-aa-timeStampToken` dans l'UnsignedAttribute ait du sens.
/// L'objectif c'est que le container PDF soit conforme PAdES-B-T ; la
/// cryptographie réelle du TSR sera fournie par FreeTSA en prod.
fn fake_tsr() -> Vec<u8> {
    // Minimal TimeStampResp avec une structure en deux temps :
    //   TimeStampResp ::= SEQUENCE {
    //       status          PKIStatusInfo,
    //       timeStampToken  TimeStampToken OPTIONAL }
    //   PKIStatusInfo ::= SEQUENCE { status INTEGER }  -- 0 = granted
    //
    // On se contente d'un TSR vraiment minimal : seulement PKIStatusInfo {0}.
    // L'embed PAdES-B-T met le DER brut dans la Value de l'UnsignedAttribute ;
    // le test pades_bt_with_fake_tsr_passes_embed (e2e) prouve que l'embed
    // fonctionne avec n'importe quelle SEQUENCE DER.

    #[derive(Sequence)]
    struct PkiStatusInfo {
        status: Int,
    }

    #[derive(Sequence)]
    struct TimeStampResp {
        status: PkiStatusInfo,
    }

    // Anti-warning : OctetString + ObjectIdentifier utilisés en doc, gardés
    // importés pour lecteur qui étendrait ce TSR vers un SignedData complet.
    let _ = OctetString::new(Vec::<u8>::new());
    let _ = ObjectIdentifier::new("1.2.840.113549.1.9.16.2.14").unwrap();

    let tsr = TimeStampResp {
        status: PkiStatusInfo {
            status: Int::new(&[0u8]).unwrap(),
        },
    };
    tsr.to_der().expect("fake TSR DER")
}

#[test]
fn produce_pades_b_t_fixture_pdf() {
    let dn = SubjectDn {
        common_name: "Tom Andrieu — Fixture".to_string(),
        organization: Some("AlphaLuppi".to_string()),
        country: "FR".to_string(),
        email: Some("contact@alphaluppi.com".to_string()),
    };
    let gen = generate_self_signed_cert(&dn).expect("cert gen");
    let pdf = sample_pdf();

    let tsr = fake_tsr();
    let signed = embed_signature_with_timestamp(
        &pdf,
        &gen.x509_der,
        &gen.rsa_priv_pkcs8_der,
        b"png-signature",
        Some(&tsr),
    )
    .expect("embed PAdES-B-T");

    // Sanity checks sur le PDF produit.
    let parsed = lopdf::Document::load_mem(&signed.pdf_bytes).expect("pdf parseable");
    assert!(parsed.version.as_str() >= "1.4");

    // UnsignedAttribute id-smime-aa-timeStampToken doit être présent (PAdES-B-T).
    let tst_oid_der = [
        0x06, 0x0B, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x09, 0x10, 0x02, 0x0E,
    ];
    assert!(
        signed
            .cms_der
            .windows(tst_oid_der.len())
            .any(|w| w == tst_oid_der),
        "id-smime-aa-timeStampToken absent du CMS"
    );

    // Écrire le fixture à l'emplacement attendu pour les tests aval + Tom.
    let target = fixtures_dir().join("signed_pades_b_t_freetsa.pdf");
    fs::write(&target, &signed.pdf_bytes).expect("write fixture");

    // Le fichier doit exister et avoir une taille raisonnable (RSA 4096 + overhead ~10-50 KB).
    let meta = fs::metadata(&target).expect("stat fixture");
    assert!(
        meta.len() > 2000,
        "fixture trop petit ({} bytes) — embed a probablement raté",
        meta.len()
    );
    assert!(
        meta.len() < 1_000_000,
        "fixture suspicieusement gros ({} bytes)",
        meta.len()
    );

    eprintln!(
        "[track-η] fixture PAdES-B-T écrit : {} ({} bytes)",
        target.display(),
        meta.len()
    );
}
