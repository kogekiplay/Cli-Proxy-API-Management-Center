import { describe, expect, test } from 'bun:test';

import {
  formatReasoningEffort,
  MONITORING_COLUMN_WIDTHS,
} from '../src/pages/usageMonitoringColumns';

describe('request monitoring columns', () => {
  test('defines twelve compact columns totaling 100 percent', () => {
    expect(MONITORING_COLUMN_WIDTHS).toEqual([8, 11, 7, 7, 6, 12, 6, 8, 11, 13, 7, 4]);
    expect(MONITORING_COLUMN_WIDTHS).toHaveLength(12);
    expect(MONITORING_COLUMN_WIDTHS.reduce((sum, width) => sum + width, 0)).toBe(100);
  });

  test('formats actual upstream reasoning effort', () => {
    expect(formatReasoningEffort(' Ultra ')).toBe('ultra');
    expect(formatReasoningEffort('')).toBe('-');
    expect(formatReasoningEffort(undefined)).toBe('-');
  });
});
