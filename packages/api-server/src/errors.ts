import type { ErrorCode } from "./types.js";

/** Erreur HTTP typée levée depuis les routes ; mappée vers JSON par errorHandler. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (message = "ressource introuvable") =>
  new HttpError(404, "NOT_FOUND", message);

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, "VALIDATION_ERROR", message, details);

export const conflict = (message: string, details?: unknown) =>
  new HttpError(409, "CONFLICT", message, details);

export const unauthorized = (message = "token manquant ou invalide") =>
  new HttpError(401, "UNAUTHORIZED", message);

export const invalidTransition = (message: string, details?: unknown) =>
  new HttpError(422, "INVALID_TRANSITION", message, details);
