import { describe, expect, test } from 'bun:test';
import { resolveUsageAnalyticsErrorDisplay } from '../src/features/usageAnalytics/usageAnalyticsErrorDisplay';

describe('usage analytics error display', () => {
  test('extracts nested OpenCode Go usage limit messages from fail body JSON', () => {
    const display = resolveUsageAnalyticsErrorDisplay(
      {
        failed: true,
        fail_summary: 'error',
        fail_body: JSON.stringify({
          type: 'error',
          error: {
            type: 'GoUsageLimitError',
            message:
              'Weekly usage limit reached. Resets in 1 day. Enable usage from available balance.',
          },
          metadata: {
            workspace: 'w_test_workspace',
            limitName: 'weekly',
          },
        }),
      },
      '无错误摘要'
    );

    expect(display.summary).toBe(
      'Weekly usage limit reached. Resets in 1 day. Enable usage from available balance.'
    );
    expect(display.title).toBe('GoUsageLimitError');
    expect(display.detail).toContain('limitName: weekly');
    expect(display.detail).not.toContain('"type":"error"');
  });

  test('uses string error fields before falling back to raw body text', () => {
    const display = resolveUsageAnalyticsErrorDisplay(
      {
        failed: true,
        fail_summary: '',
        fail_body: JSON.stringify({ error: 'upstream temporarily unavailable' }),
      },
      '无错误摘要'
    );

    expect(display.summary).toBe('upstream temporarily unavailable');
    expect(display.title).toBe('upstream temporarily unavailable');
  });

  test('keeps raw body as detail when body cannot be parsed', () => {
    const display = resolveUsageAnalyticsErrorDisplay(
      {
        failed: true,
        fail_summary: 'upstream error',
        fail_body: '<html>forbidden</html>',
      },
      '无错误摘要'
    );

    expect(display.summary).toBe('upstream error');
    expect(display.detail).toBe('<html>forbidden</html>');
  });

  test('leaves successful rows without errors empty', () => {
    const display = resolveUsageAnalyticsErrorDisplay(
      {
        failed: false,
        fail_summary: '',
        fail_body: '',
      },
      '无错误摘要'
    );

    expect(display.summary).toBe('');
    expect(display.title).toBe('');
    expect(display.detail).toBe('');
  });
});
