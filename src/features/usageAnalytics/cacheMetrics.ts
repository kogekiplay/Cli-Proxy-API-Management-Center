export interface CacheMetricTokens {
  input_tokens?: number;
  total_input_tokens?: number;
  cached_tokens?: number;
  cache_read_tokens?: number;
}

export function calculateCacheHitRate(tokens?: CacheMetricTokens | null): number | null {
  const totalInput = tokens?.total_input_tokens ?? tokens?.input_tokens ?? 0;
  if (!Number.isFinite(totalInput) || totalInput <= 0) return null;

  const cached = Math.max(0, tokens?.cached_tokens ?? 0);
  const cacheRead = Math.max(0, tokens?.cache_read_tokens ?? 0);
  return Math.min(100, ((cached + cacheRead) / totalInput) * 100);
}
