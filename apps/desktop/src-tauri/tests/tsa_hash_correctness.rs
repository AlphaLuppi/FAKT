//! Vérifie que `tsa_imprint_for_cms` respecte RFC 3161 §2.5 — c.-à-d. que le
//! `messageImprint.hashedMessage` du TimeStampReq est bien SHA-256 de la valeur
//! du BIT STRING `SignerInfo.signature`, et non pas SHA-256 du CMS entier.
//!
//! Avant Track η, le code hashait tout le CMS par convention mais le commentaire
//! avait dérivé vers un `hash le CMS entier — la lib TSA côté serveur traite le
//! digest fourni comme opaque`, créant un risque de désalignement si un futur
//! refactor basait le hash sur ce commentaire. On verrouille le comportement par
//! un test explicite.
//!
//! Spec ETSI EN 319 142-1 §5.3 :
//!   « The value of the messageImprint field within TimeStampToken shall be a
//!     hash of the signature value that the time-stamp is applied to. »
//!
//! Pour PAdES-B-T, signature value == `SignerInfo.signature` (RFC 5652 §5.3).

use cms::content_info::ContentInfo;
use cms::signed_data::SignedData;
use der::Decode;
use sha2::{Digest, Sha256};

use fakt_lib::crypto::cert::{generate_self_signed_cert, SubjectDn};
use fakt_lib::crypto::commands::tsa_imprint_for_cms;
use fakt_lib::crypto::pades::embed_signature_with_timestamp;

fn sample_dn() -> SubjectDn {
    SubjectDn {
        common_name: "Test TSA Hash".to_string(),
        organization: Some("FAKT".to_string()),
        country: "FR".to_string(),
        email: Some("test@example.com".to_string()),
    }
}

fn minimal_pdf() -> Vec<u8> {
    use lopdf::{dictionary, Document, Object, Stream};
    let mut doc = Document::with_version("1.4");
    let font_id = doc.add_object(dictionary! {
        "Type" => "Font",
        "Subtype" => "Type1",
        "BaseFont" => "Helvetica",
    });
    let content = b"BT /F1 20 Tf 100 700 Td (HASH TEST) Tj ET".to_vec();
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

#[test]
fn imprint_matches_sha256_of_signer_info_signature_not_whole_cms() {
    let gen = generate_self_signed_cert(&sample_dn()).expect("cert gen");
    let pdf = minimal_pdf();
    let signed = embed_signature_with_timestamp(
        &pdf,
        &gen.x509_der,
        &gen.rsa_priv_pkcs8_der,
        b"png",
        None,
    )
    .expect("embed PAdES-B");

    let imprint = tsa_imprint_for_cms(&signed.cms_der).expect("imprint");

    // Référence : recalcule indépendamment le hash de SignerInfo.signature.
    let ci = ContentInfo::from_der(&signed.cms_der).expect("ci parse");
    let sd: SignedData = ci.content.decode_as().expect("sd parse");
    let si = sd
        .signer_infos
        .0
        .as_slice()
        .first()
        .expect("signer info");
    let sig_bytes = si.signature.as_bytes();
    let mut h = Sha256::new();
    h.update(sig_bytes);
    let expected: [u8; 32] = h.finalize().into();

    assert_eq!(
        imprint, expected,
        "messageImprint doit être SHA-256(SignerInfo.signature), RFC 3161 §2.5"
    );

    // Contre-exemple explicite : le hash du CMS entier NE DOIT PAS être égal.
    let mut h2 = Sha256::new();
    h2.update(&signed.cms_der);
    let hash_whole_cms: [u8; 32] = h2.finalize().into();
    assert_ne!(
        imprint, hash_whole_cms,
        "régression : imprint ne doit jamais être SHA-256(cms_der entier)"
    );
}

#[test]
fn imprint_is_deterministic_across_calls() {
    // Même CMS en entrée → même hash en sortie (propriété basique SHA-256).
    let gen = generate_self_signed_cert(&sample_dn()).expect("cert gen");
    let pdf = minimal_pdf();
    let signed = embed_signature_with_timestamp(
        &pdf,
        &gen.x509_der,
        &gen.rsa_priv_pkcs8_der,
        b"png",
        None,
    )
    .expect("embed");

    let a = tsa_imprint_for_cms(&signed.cms_der).expect("a");
    let b = tsa_imprint_for_cms(&signed.cms_der).expect("b");
    assert_eq!(a, b);
}

#[test]
fn imprint_parse_error_on_malformed_cms() {
    let bogus = [0u8; 8];
    let err = tsa_imprint_for_cms(&bogus).expect_err("malformed cms should err");
    let msg = err.to_string();
    assert!(
        msg.contains("ci parse") || msg.contains("sd parse"),
        "message inattendu: {msg}"
    );
}
