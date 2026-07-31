/**
 * AI model profile — shared type for AI settings forms.
 *
 * NOTE: purposes is stored as an object on the frontend (checkbox state)
 * but normalized to string[] on the backend by resolveProfiles().
 */
export interface AiProfile {
  id: string;
  name: string;
  provider: "openai" | "deepseek" | "zhipu" | "modelscope" | "openrouter" | "custom";
  api_url: string;
  model: string;
  api_key: string;
  /** 后端脱敏返回时替代 api_key（布尔，表示是否已配置） */
  has_api_key?: boolean;
  /** 后端脱敏返回的掩码 key（如 "sk-****5678"） */
  api_key_masked?: string;
  /** 关闭思考模式（对支持的模型注入 thinking:disabled，如智谱） */
  disable_thinking?: boolean;
  enabled: boolean;
  purposes: {
    summary?: boolean;
    chat?: boolean;
    writing?: boolean;
  };
}
