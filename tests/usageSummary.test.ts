import { describe, expect, test } from 'bun:test';
import type { UsageModelSummary, UsageSummary } from '../src/types/usage';
import { rebuildUsageSummaryFromRows } from '../src/utils/quota/usageSummary';

const baseSummary = (): UsageSummary => ({
  window: {
    start: '2026-07-08T00:00:00Z',
    end: '2026-07-08T05:00:00Z',
  },
  request_count: 0,
  failed_count: 0,
  tokens: {
    input_tokens: 0,
    output_tokens: 0,
    reasoning_tokens: 0,
    cached_tokens: 0,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
    total_tokens: 0,
  },
  estimated_cost_usd: null,
  missing_price_models: [],
  rows: [],
  source: 'test',
});

describe('rebuildUsageSummaryFromRows', () => {
  test('keeps known row costs when some models are missing prices', () => {
    const rows: UsageModelSummary[] = [
      {
        model: 'gpt-priced',
        request_count: 2,
        failed_count: 0,
        tokens: {
          input_tokens: 100,
          output_tokens: 50,
          reasoning_tokens: 0,
          cached_tokens: 10,
          cache_read_tokens: 10,
          cache_creation_tokens: 0,
          total_tokens: 150,
        },
        estimated_cost_usd: 0.25,
        missing_price_models: [],
      },
      {
        model: 'grok-unpriced',
        request_count: 1,
        failed_count: 1,
        tokens: {
          input_tokens: 20,
          output_tokens: 5,
          reasoning_tokens: 0,
          cached_tokens: 0,
          cache_read_tokens: 0,
          cache_creation_tokens: 0,
          total_tokens: 25,
        },
        estimated_cost_usd: null,
        missing_price_models: ['grok-unpriced'],
      },
    ];

    const summary = rebuildUsageSummaryFromRows(baseSummary(), rows);

    expect(summary.estimated_cost_usd).toBe(0.25);
    expect(summary.missing_price_models).toEqual(['grok-unpriced']);
    expect(summary.request_count).toBe(3);
    expect(summary.failed_count).toBe(1);
    expect(summary.tokens.total_tokens).toBe(175);
  });
});
