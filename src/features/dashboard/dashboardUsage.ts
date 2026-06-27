import type {
  UsageAnalyticsEventRow,
  UsageAnalyticsRequest,
  UsageAnalyticsResponse,
  UsageAnalyticsTimelinePoint,
} from '@/services/api/usageAnalytics';

export const DASHBOARD_USAGE_RANGE_MS = 7 * 24 * 60 * 60 * 1000;
export const DASHBOARD_USAGE_EVENT_LIMIT = 5;

const EMPTY_EVENTS: UsageAnalyticsEventRow[] = [];
const EMPTY_TIMELINE: UsageAnalyticsTimelinePoint[] = [];

export interface DashboardUsageSummary {
  events: UsageAnalyticsEventRow[];
  hasUsageData: boolean;
  timeline: UsageAnalyticsTimelinePoint[];
  timelineMaxCalls: number;
  totalCalls: number;
}

export function buildDashboardUsageRequest(now = Date.now()): UsageAnalyticsRequest {
  return {
    from_ms: now - DASHBOARD_USAGE_RANGE_MS,
    to_ms: now,
    filters: {
      include_failed: true,
    },
    include: {
      summary: true,
      timeline: true,
      events_page: {
        limit: DASHBOARD_USAGE_EVENT_LIMIT,
      },
    },
  };
}

export function summarizeDashboardUsage(
  response: UsageAnalyticsResponse | null | undefined
): DashboardUsageSummary {
  const events = response?.events?.items ?? EMPTY_EVENTS;
  const timeline = response?.timeline ?? EMPTY_TIMELINE;
  const totalCalls =
    response?.summary?.total_calls ??
    timeline.reduce((sum, point) => sum + Math.max(0, point.calls || 0), 0);
  const timelineMaxCalls = Math.max(...timeline.map((point) => point.calls || 0), 1);

  return {
    events,
    hasUsageData: totalCalls > 0 || events.length > 0 || timeline.some((point) => point.calls > 0),
    timeline,
    timelineMaxCalls,
    totalCalls,
  };
}
