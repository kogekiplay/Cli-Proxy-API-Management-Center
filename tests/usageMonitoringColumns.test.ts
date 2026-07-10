import { describe, expect, test } from 'bun:test';

import {
  formatReasoningEffort,
  MONITORING_COLUMN_WIDTHS,
  monitoringProviderLabel,
} from '../src/pages/usageMonitoringColumns';

describe('request monitoring columns', () => {
  test('defines eleven compact columns totaling 100 percent', () => {
    expect(MONITORING_COLUMN_WIDTHS).toEqual([8, 12, 8, 10, 6, 10, 6, 12, 15, 9, 4]);
    expect(MONITORING_COLUMN_WIDTHS).toHaveLength(11);
    expect(MONITORING_COLUMN_WIDTHS.reduce((sum, width) => sum + width, 0)).toBe(100);
  });

  test('uses compact provider labels for monitoring rows', () => {
    expect(monitoringProviderLabel('openai-compatible-cf worker')).toBe('cf worker');
    expect(monitoringProviderLabel('openai-compatible-opencode-go')).toBe('opencode-go');
    expect(monitoringProviderLabel('codex')).toBe('Codex');
  });

  test('formats actual upstream reasoning effort', () => {
    expect(formatReasoningEffort(' Ultra ')).toBe('ultra');
    expect(formatReasoningEffort('')).toBe('-');
    expect(formatReasoningEffort(undefined)).toBe('-');
  });
});
