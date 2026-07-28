/**
 * ToolDef — framework-agnostic tool definition type.
 * Per AI-03: Zero imports from 'ai' or '@ai-sdk/*'.
 * This is the migration-protected asset that survives a future LangGraph switch unchanged.
 *
 * ToolContext — execution context passed to tool execute functions.
 * Per D-350: Tools resolve domain services via getService instead of direct db queries.
 */
import { z } from 'zod';
import type { SettingsService } from '../../settings/settings.service';

export interface ToolContext {
  db: unknown;
  settings: SettingsService;
  getService<T>(token: string): T;
}

export interface ToolDef<
  TSchema extends z.ZodType = z.ZodType,
  TResult = unknown,
> {
  name: string;
  description: string;
  inputSchema: TSchema;
  execute: (input: z.infer<TSchema>, ctx: ToolContext) => Promise<TResult>;
}
