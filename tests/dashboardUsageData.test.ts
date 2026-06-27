import { describe, expect, test } from 'bun:test';
import {
  buildDashboardRangeTrend,
  buildDashboardDailyTrend,
  buildDashboardUsageRequest,
  summarizeDashboardUsage,
} from '../src/features/dashboard/dashboardUsage';

describe('dashboard usage data', () => {
  test('requests seven day usage timeline and recent events for the dashboard', () => {
    const now = Date.UTC(2026, 5, 27, 12, 0, 0);
    const request = buildDashboardUsageRequest(now);

    expect(request.from_ms).toBe(now - 7 * 24 * 60 * 60 * 1000);
    expect(request.to_ms).toBe(now);
    expect(request.include?.summary).toBe(true);
    expect(request.include?.timeline).toBe(true);
    expect(request.include?.events_page?.limit).toBe(5);
    expect(request.filters?.include_failed).toBe(true);
  });

  test('requests the selected dashboard usage range', () => {
    const now = Date.UTC(2026, 5, 27, 12, 0, 0);

    expect(buildDashboardUsageRequest(now, '5h').from_ms).toBe(now - 5 * 60 * 60 * 1000);
    expect(buildDashboardUsageRequest(now, '7d').from_ms).toBe(now - 7 * 24 * 60 * 60 * 1000);
    expect(buildDashboardUsageRequest(now, '30d').from_ms).toBe(now - 30 * 24 * 60 * 60 * 1000);
  });

  test('summarizes calls, events and chart scale from usage analytics response', () => {
    const summary = summarizeDashboardUsage({
      generated_at_ms: 1,
      summary: {
        total_calls: 8,
        success_calls: 7,
        failure_calls: 1,
        input_tokens: 0,
        output_tokens: 0,
        reasoning_tokens: 0,
        cached_tokens: 0,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        total_tokens: 0,
      },
      timeline: [
        { bucket_ms: 1, calls: 2, success: 2, failure: 0, total_tokens: 200 },
        { bucket_ms: 2, calls: 6, success: 5, failure: 1, total_tokens: 800 },
      ],
      events: {
        items: [
          {
            id: 10,
            request_id: 'req_10',
            timestamp_ms: 2,
            provider: 'codex',
            model: 'gpt-5.5',
            endpoint: 'POST /v1/responses',
            auth_index: 'auth-1',
            auth_file_name: 'codex.json',
            api_key_hash: 'hash',
            account_ref: 'user@example.com',
            service_tier: 'default',
            tokens: {
              input_tokens: 1,
              output_tokens: 2,
              reasoning_tokens: 0,
              cached_tokens: 0,
              cache_read_tokens: 0,
              cache_creation_tokens: 0,
              total_tokens: 3,
            },
            failed: false,
          },
        ],
        has_more: false,
        total_count: 1,
      },
    });

    expect(summary.totalCalls).toBe(8);
    expect(summary.timelineMaxCalls).toBe(6);
    expect(summary.events).toHaveLength(1);
    expect(summary.hasUsageData).toBe(true);
  });

  test('builds compact daily trend buckets for the operations dashboard chart', () => {
    const now = new Date(2026, 5, 27, 12, 0, 0).getTime();
    const trend = buildDashboardDailyTrend(
      [
        { bucket_ms: new Date(2026, 5, 21, 1, 0, 0).getTime(), calls: 4 },
        { bucket_ms: new Date(2026, 5, 21, 22, 0, 0).getTime(), calls: 6 },
        { bucket_ms: new Date(2026, 5, 25, 12, 0, 0).getTime(), calls: 3 },
      ],
      now
    );

    expect(trend).toHaveLength(7);
    expect(trend.map((point) => point.calls)).toEqual([10, 0, 0, 0, 3, 0, 0]);
    expect(trend.at(0)?.label).toMatch(/6\/21|21\/6/);
    expect(trend.at(-1)?.label).toMatch(/6\/27|27\/6/);
  });

  test('builds hourly and monthly trend buckets for selectable dashboard ranges', () => {
    const now = new Date(2026, 5, 27, 12, 30, 0).getTime();
    const hourlyTrend = buildDashboardRangeTrend(
      [
        { bucket_ms: new Date(2026, 5, 27, 8, 10, 0).getTime(), calls: 2 },
        { bucket_ms: new Date(2026, 5, 27, 12, 5, 0).getTime(), calls: 3 },
      ],
      now,
      '5h'
    );

    expect(hourlyTrend).toHaveLength(6);
    expect(hourlyTrend.map((point) => point.calls)).toEqual([0, 2, 0, 0, 0, 3]);
    expect(hourlyTrend.at(0)?.label).toMatch(/^\d{2}:00$/);
    expect(hourlyTrend.at(-1)?.label).toMatch(/^\d{2}:00$/);

    const monthlyTrend = buildDashboardRangeTrend(
      [{ bucket_ms: new Date(2026, 5, 1, 9, 0, 0).getTime(), calls: 9 }],
      now,
      '30d'
    );

    expect(monthlyTrend).toHaveLength(30);
    expect(monthlyTrend.some((point) => point.calls === 9)).toBe(true);
    expect(monthlyTrend.filter((point) => point.label).length).toBeLessThanOrEqual(8);
    expect(
      monthlyTrend
        .filter((point) => point.label)
        .every((point) => /\d+\/\d+|\d+\.\d+|\d+-\d+/.test(point.label))
    ).toBe(true);
  });
});
