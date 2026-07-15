import { describe, expect, test } from 'bun:test';
import { calculateCacheHitRate } from '../src/features/usageAnalytics/cacheMetrics';

describe('usage analytics cache metrics', () => {
  test('uses canonical total input and combines only C and CR as cache hits', () => {
    expect(
      calculateCacheHitRate({
        input_tokens: 999,
        total_input_tokens: 1000,
        cached_tokens: 100,
        cache_read_tokens: 300,
      })
    ).toBe(40);
  });

  test('falls back to input tokens for older responses', () => {
    expect(calculateCacheHitRate({ input_tokens: 200, cache_read_tokens: 50 })).toBe(25);
  });

  test('returns no rate without input and clamps malformed counters', () => {
    expect(calculateCacheHitRate({ input_tokens: 0, cache_read_tokens: 50 })).toBeNull();
    expect(calculateCacheHitRate({ input_tokens: 100, cache_read_tokens: 150 })).toBe(100);
  });
});
