/**
 * AI model profile — shared type for AI settings forms.
 *
 * NOTE: purposes is stored as an object on the frontend (checkbox state)
 * but normalized to string[] on the backend by resolveProfiles().
 */
export interface AiProfile {
  id: string;
  name: string;
  provider: "openai" | "deepseek" | "custom";
  api_url: string;
  model: string;
  api_key: string;
  enabled: boolean;
  purposes: {
    summary?: boolean;
    chat?: boolean;
    writing?: boolean;
  };
}
