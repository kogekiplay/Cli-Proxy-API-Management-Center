import type { TokenUsage, UsageModelSummary, UsageSummary } from '@/types/usage';

const emptyTokenUsage = (): TokenUsage => ({
  input_tokens: 0,
  uncached_input_tokens: 0,
  total_input_tokens: 0,
  output_tokens: 0,
  reasoning_tokens: 0,
  cached_tokens: 0,
  cache_read_tokens: 0,
  cache_creation_tokens: 0,
  total_tokens: 0,
});

const addTokenUsage = (left: TokenUsage, right: TokenUsage): TokenUsage => ({
  input_tokens: left.input_tokens + right.input_tokens,
  uncached_input_tokens: (left.uncached_input_tokens ?? 0) + (right.uncached_input_tokens ?? 0),
  total_input_tokens: (left.total_input_tokens ?? 0) + (right.total_input_tokens ?? 0),
  output_tokens: left.output_tokens + right.output_tokens,
  reasoning_tokens: left.reasoning_tokens + right.reasoning_tokens,
  cached_tokens: left.cached_tokens + right.cached_tokens,
  cache_read_tokens: left.cache_read_tokens + right.cache_read_tokens,
  cache_creation_tokens: left.cache_creation_tokens + right.cache_creation_tokens,
  total_tokens: left.total_tokens + right.total_tokens,
});

export const normalizeUsageModelKey = (value: string): string => value.trim().toLowerCase();

export const rebuildUsageSummaryFromRows = (
  summary: UsageSummary,
  rows: UsageModelSummary[]
): UsageSummary => {
  const missingPriceModels = Array.from(
    new Set(rows.flatMap((row) => row.missing_price_models ?? []))
  ).sort();
  const pricedRows = rows.filter((row) => row.estimated_cost_usd !== null);
  const estimatedCost =
    pricedRows.length > 0
      ? pricedRows.reduce((sum, row) => sum + (row.estimated_cost_usd ?? 0), 0)
      : null;

  return {
    ...summary,
    request_count: rows.reduce((sum, row) => sum + row.request_count, 0),
    failed_count: rows.reduce((sum, row) => sum + row.failed_count, 0),
    tokens: rows.reduce((sum, row) => addTokenUsage(sum, row.tokens), emptyTokenUsage()),
    estimated_cost_usd: estimatedCost,
    missing_price_models: missingPriceModels,
    rows,
  };
};
