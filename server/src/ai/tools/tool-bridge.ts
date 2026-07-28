/**
 * tool-bridge.ts — converts framework-agnostic ToolDef[] to AI SDK tool() objects.
 *
 * Per D-363: This is the ONLY file that imports `tool` from `ai`.
 * ToolDef stays framework-agnostic; tool-bridge is the adapter layer.
 * Zero NestJS imports — framework-agnostic converter.
 */
import { tool, type ToolSet } from 'ai';
import type { ToolDef, ToolContext } from './tool-def';

/**
 * Convert an array of ToolDef definitions to an AI SDK ToolSet object map.
 * Each tool gets: description, inputSchema (Zod schema), and execute that
 * delegates to def.execute(input, ctx).
 *
 * AI SDK 7 tool() uses `inputSchema` as the key for the Zod schema.
 */
export function toAiSdkTools(defs: ToolDef[], ctx: ToolContext): ToolSet {
  const tools: ToolSet = {};

  for (const def of defs) {
    tools[def.name] = tool({
      description: def.description,
      inputSchema: def.inputSchema,
      execute: async (input) => def.execute(input, ctx),
    });
  }

  return tools;
}
