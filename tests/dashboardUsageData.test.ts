import { describe, expect, test } from 'bun:test';
import {
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
});
