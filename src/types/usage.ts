export interface TokenUsage {
  input_tokens: number;
  uncached_input_tokens?: number;
  total_input_tokens?: number;
  output_tokens: number;
  reasoning_tokens: number;
  cached_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  total_tokens: number;
}

export interface UsageWindow {
  start: string;
  end: string;
}

export interface ModelPrice {
  model: string;
  input_per_1m: number;
  output_per_1m: number;
  cache_read_per_1m: number;
  cache_creation_per_1m: number;
  cached_per_1m?: number;
  source?: string;
  source_model_id?: string;
  updated_at?: string;
}

export interface UsageModelSummary {
  model: string;
  request_count: number;
  failed_count: number;
  tokens: TokenUsage;
  estimated_cost_usd: number | null;
  missing_price_models?: string[];
}

export interface UsageSummary {
  window: UsageWindow;
  request_count: number;
  failed_count: number;
  tokens: TokenUsage;
  estimated_cost_usd: number | null;
  missing_price_models: string[];
  rows: UsageModelSummary[];
  source: string;
}

export type UsageSummaryWindowKind = '5h' | '7d' | 'month';

export interface UsageSummaryParams {
  provider: string;
  model?: string;
  authIndex?: string;
  apiKeyHash?: string;
  accountRef?: string;
  window?: UsageSummaryWindowKind;
  resetAt?: string;
  start?: string;
  end?: string;
}
