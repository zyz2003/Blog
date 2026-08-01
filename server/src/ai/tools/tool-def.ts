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
  getService<T>(token: ServiceIdentifier): T;
}

/**
 * 服务定位标识：服务类（构造函数）或字符串 token。
 * 注意：NestJS 的类注册 provider 用类作 token，moduleRef.get 传字符串匹配不到。
 */
export type ServiceIdentifier =
  | (abstract new (...args: any[]) => any)
  | string;

export interface ToolDef<
  TSchema extends z.ZodType = z.ZodType,
  TResult = unknown,
> {
  name: string;
  description: string;
  inputSchema: TSchema;
  execute: (input: z.infer<TSchema>, ctx: ToolContext) => Promise<TResult>;
}
