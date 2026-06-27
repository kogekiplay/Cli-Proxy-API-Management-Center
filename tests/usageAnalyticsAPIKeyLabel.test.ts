import { describe, expect, test } from 'bun:test';
import { maskUsageAnalyticsClientAPIKey } from '../src/features/usageAnalytics/usageAnalyticsLabels';

describe('usage analytics API key labels', () => {
  test('shows only the masked key without an ordinal prefix', () => {
    expect(maskUsageAnalyticsClientAPIKey('sk-test-alpha-0001')).toBe('sk-test...0001');
    expect(maskUsageAnalyticsClientAPIKey(' sk-test-beta-0002 ')).toBe('sk-test...0002');
  });

  test('falls back to API Key only for blank configured keys', () => {
    expect(maskUsageAnalyticsClientAPIKey('   ')).toBe('API Key');
  });
});
