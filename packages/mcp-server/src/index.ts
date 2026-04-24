#!/usr/bin/env bun
/**
 * @fakt/mcp-server — entry point stdio MCP.
 *
 * Lancé par Claude Code CLI via `--mcp-config` (config JSON généré par Rust
 * dans apps/desktop/src-tauri/src/ai/cli.rs). Expose les endpoints du sidecar
 * api-server de FAKT comme tools MCP.
 *
 * Ce process a une durée de vie courte : 1 spawn = 1 session Claude. Claude
 * peut appeler les tools plusieurs fois pendant la conversation, puis le
 * process s'arrête quand stdio ferme.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { clientsTools } from "./tools/clients.ts";
import { invoicesTools } from "./tools/invoices.ts";
import { quotesTools } from "./tools/quotes.ts";
import { servicesTools } from "./tools/services.ts";
import type { ToolRegistration } from "./tools/types.ts";
import { workspaceTools } from "./tools/workspace.ts";

const ALL_TOOLS: ToolRegistration[] = [
  ...workspaceTools,
  ...clientsTools,
  ...servicesTools,
  ...quotesTools,
  ...invoicesTools,
];

async function main(): Promise<void> {
  const server = new McpServer({
    name: "fakt",
    version: "0.1.7",
  });

  for (const tool of ALL_TOOLS) {
    // Cast via `as never` : McpServer.registerTool a une signature générique
    // avec types conditionnels qui s'effondre quand on itère sur des tools
    // hétérogènes. Le typage runtime reste garanti par Zod côté handler.
    (
      server.registerTool as (
        name: string,
        config: { description: string; inputSchema: unknown },
        handler: (args: Record<string, unknown>) => Promise<{
          content: Array<{ type: "text"; text: string }>;
        }>
      ) => void
    )(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.schema,
      },
      async (args: Record<string, unknown>) => {
        const result = await tool.handler(args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  // Claude CLI montre stderr dans les logs — aidera à debug si le MCP fail.
  console.error("[fakt-mcp] erreur fatale :", err);
  process.exit(1);
});
