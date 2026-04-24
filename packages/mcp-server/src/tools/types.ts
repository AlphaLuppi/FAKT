/**
 * Types partagés pour les tool definitions MCP.
 * Un ToolRegistration a un nom, une description, un schéma Zod d'entrée, et un handler async.
 */
import type { ZodRawShape } from "zod";

export interface ToolRegistration<TArgs = Record<string, unknown>> {
  name: string;
  description: string;
  schema: ZodRawShape;
  handler: (args: TArgs) => Promise<unknown>;
}
