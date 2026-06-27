import type {
  UsageAnalyticsEventRow,
  UsageAnalyticsRequest,
  UsageAnalyticsResponse,
  UsageAnalyticsTimelinePoint,
} from '@/services/api/usageAnalytics';

export const DASHBOARD_USAGE_RANGE_MS = 7 * 24 * 60 * 60 * 1000;
export const DASHBOARD_USAGE_EVENT_LIMIT = 5;
const DASHBOARD_TREND_DAYS = 7;

const EMPTY_EVENTS: UsageAnalyticsEventRow[] = [];
const EMPTY_TIMELINE: UsageAnalyticsTimelinePoint[] = [];

export interface DashboardUsageSummary {
  events: UsageAnalyticsEventRow[];
  hasUsageData: boolean;
  timeline: UsageAnalyticsTimelinePoint[];
  timelineMaxCalls: number;
  totalCalls: number;
}

export interface DashboardTrendPoint {
  dayStartMs: number;
  label: string;
  calls: number;
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

const startOfLocalDay = (value: number) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const formatDashboardTrendLabel = (dayStartMs: number) =>
  new Date(dayStartMs).toLocaleDateString(undefined, {
    month: 'numeric',
    day: 'numeric',
  });

export function buildDashboardDailyTrend(
  timeline: UsageAnalyticsTimelinePoint[] | null | undefined,
  now = Date.now(),
  days = DASHBOARD_TREND_DAYS
): DashboardTrendPoint[] {
  const safeDays = Math.max(1, Math.floor(days));
  const todayStart = startOfLocalDay(now);
  const firstDayStart = todayStart - (safeDays - 1) * 24 * 60 * 60 * 1000;
  const buckets = new Map<number, number>();

  for (let index = 0; index < safeDays; index += 1) {
    buckets.set(firstDayStart + index * 24 * 60 * 60 * 1000, 0);
  }

  for (const point of timeline ?? []) {
    if (!Number.isFinite(point.bucket_ms)) continue;
    const dayStartMs = startOfLocalDay(point.bucket_ms);
    if (!buckets.has(dayStartMs)) continue;
    buckets.set(dayStartMs, (buckets.get(dayStartMs) ?? 0) + Math.max(0, point.calls || 0));
  }

  return Array.from(buckets.entries()).map(([dayStartMs, calls]) => ({
    dayStartMs,
    label: formatDashboardTrendLabel(dayStartMs),
    calls,
  }));
}
