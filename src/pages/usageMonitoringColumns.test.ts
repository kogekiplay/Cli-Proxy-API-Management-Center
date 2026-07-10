import { describe, expect, test } from 'bun:test';

import { formatReasoningEffort, MONITORING_COLUMN_WIDTHS } from './usageMonitoringColumns';

describe('request monitoring columns', () => {
  test('defines ten columns totaling 100 percent', () => {
    expect(MONITORING_COLUMN_WIDTHS).toHaveLength(10);
    expect(MONITORING_COLUMN_WIDTHS.reduce((sum, width) => sum + width, 0)).toBe(100);
  });

  test('formats actual upstream reasoning effort', () => {
    expect(formatReasoningEffort(' Ultra ')).toBe('ultra');
    expect(formatReasoningEffort('')).toBe('-');
    expect(formatReasoningEffort(undefined)).toBe('-');
  });
});
