import type { ErrorHandler } from "hono";
import { ZodError } from "zod";
import { HttpError } from "../errors.js";
import type { ApiErrorBody, AppEnv } from "../types.js";

function zodIssueSummary(err: ZodError): { field?: string; message: string; issues: unknown } {
  const first = err.issues[0];
  const field = first?.path.join(".");
  return {
    ...(field ? { field } : {}),
    message: first?.message ?? "validation error",
    issues: err.issues,
  };
}

/** Mappe toute exception vers un body JSON standardisé + code HTTP approprié. */
export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof HttpError) {
    const body: ApiErrorBody = {
      error: err.details
        ? { code: err.code, message: err.message, details: err.details }
        : { code: err.code, message: err.message },
    };
    return c.json(body, err.status as 400 | 401 | 404 | 409 | 422 | 500);
  }

  if (err instanceof ZodError) {
    const summary = zodIssueSummary(err);
    const body: ApiErrorBody = {
      error: {
        code: "VALIDATION_ERROR",
        message: summary.message,
        details: { field: summary.field, issues: summary.issues },
      },
    };
    return c.json(body, 400);
  }

  const message = err instanceof Error ? err.message : String(err);
  const isUniqueConstraint = /UNIQUE constraint|constraint failed/i.test(message);
  if (isUniqueConstraint) {
    const body: ApiErrorBody = {
      error: { code: "CONFLICT", message: "contrainte d'unicité violée" },
    };
    return c.json(body, 409);
  }

  console.error(
    JSON.stringify({
      level: "error",
      msg: "unhandled",
      requestId: c.get("requestId"),
      path: c.req.path,
      method: c.req.method,
      error: message,
    })
  );
  const body: ApiErrorBody = {
    error: { code: "INTERNAL_ERROR", message: "erreur interne du serveur" },
  };
  return c.json(body, 500);
};
