import { describe, expect, it } from "vitest";
import { validateSignatureSubmit } from "./schema.js";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";
const NON_EMPTY_PNG = new Uint8Array([137, 80, 78, 71]);

describe("validateSignatureSubmit", () => {
  it("accepte un payload complet", () => {
    const res = validateSignatureSubmit({
      docId: VALID_UUID,
      docType: "quote",
      mode: "draw",
      signaturePng: NON_EMPTY_PNG,
      ack: true,
    });
    expect(res.success).toBe(true);
  });

  it("refuse un docId non-UUID", () => {
    const res = validateSignatureSubmit({
      docId: "not-a-uuid",
      docType: "quote",
      mode: "draw",
      signaturePng: NON_EMPTY_PNG,
      ack: true,
    });
    expect(res.success).toBe(false);
  });

  it("refuse un PNG vide", () => {
    const res = validateSignatureSubmit({
      docId: VALID_UUID,
      docType: "invoice",
      mode: "type",
      signaturePng: new Uint8Array(),
      ack: true,
    });
    expect(res.success).toBe(false);
  });

  it("refuse un ack=false", () => {
    const res = validateSignatureSubmit({
      docId: VALID_UUID,
      docType: "quote",
      mode: "draw",
      signaturePng: NON_EMPTY_PNG,
      ack: false,
    });
    expect(res.success).toBe(false);
  });

  it("refuse un docType invalide", () => {
    const res = validateSignatureSubmit({
      docId: VALID_UUID,
      docType: "contract",
      mode: "draw",
      signaturePng: NON_EMPTY_PNG,
      ack: true,
    });
    expect(res.success).toBe(false);
  });
});
