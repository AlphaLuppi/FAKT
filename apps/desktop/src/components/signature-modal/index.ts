export { SignatureModal } from "./SignatureModal.js";
export type { SignatureModalProps, SignableDocType } from "./SignatureModal.js";
export { SignatureCanvas } from "./SignatureCanvas.js";
export type { SignatureCanvasHandle, SignatureCanvasProps } from "./SignatureCanvas.js";
export { TypeSignature } from "./TypeSignature.js";
export type { TypeSignatureHandle, TypeSignatureProps } from "./TypeSignature.js";
export {
  validateSignatureSubmit,
  signatureSubmitSchema,
  type SignatureSubmitInput,
} from "./schema.js";
export { drawSmoothPath, smoothStroke, buildQuadSegment } from "./smoothing.js";
export type { Point, QuadSegment } from "./smoothing.js";
