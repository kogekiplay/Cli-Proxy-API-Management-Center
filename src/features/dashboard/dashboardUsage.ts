import type {
  UsageAnalyticsEventRow,
  UsageAnalyticsRequest,
  UsageAnalyticsResponse,
  UsageAnalyticsTimelinePoint,
} from '@/services/api/usageAnalytics';

export const DASHBOARD_USAGE_RANGE_MS = 7 * 24 * 60 * 60 * 1000;
export const DASHBOARD_USAGE_EVENT_LIMIT = 5;
const DASHBOARD_TREND_DAYS = 7;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const DASHBOARD_USAGE_RANGE_OPTIONS = [
  {
    value: '5h',
    durationMs: 5 * HOUR_MS,
    defaultLabel: '5 小时',
    labelKey: 'dashboard.usage_range_5h',
  },
  {
    value: '7d',
    durationMs: DASHBOARD_USAGE_RANGE_MS,
    defaultLabel: '7 天',
    labelKey: 'dashboard.usage_range_7d',
  },
  {
    value: '30d',
    durationMs: 30 * DAY_MS,
    defaultLabel: '30 天',
    labelKey: 'dashboard.usage_range_30d',
  },
] as const;

export type DashboardUsageRange = (typeof DASHBOARD_USAGE_RANGE_OPTIONS)[number]['value'];

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

export function getDashboardUsageRangeOption(range: DashboardUsageRange) {
  return (
    DASHBOARD_USAGE_RANGE_OPTIONS.find((option) => option.value === range) ??
    DASHBOARD_USAGE_RANGE_OPTIONS[1]
  );
}

export function buildDashboardUsageRequest(
  now = Date.now(),
  range: DashboardUsageRange = '7d'
): UsageAnalyticsRequest {
  const option = getDashboardUsageRangeOption(range);
  return {
    from_ms: now - option.durationMs,
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

const startOfLocalHour = (value: number) => {
  const date = new Date(value);
  date.setMinutes(0, 0, 0);
  return date.getTime();
};

const formatDashboardTrendLabel = (dayStartMs: number) =>
  new Date(dayStartMs).toLocaleDateString(undefined, {
    month: 'numeric',
    day: 'numeric',
  });

const formatDashboardHourLabel = (hourStartMs: number) =>
  new Date(hourStartMs).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
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

export function buildDashboardRangeTrend(
  timeline: UsageAnalyticsTimelinePoint[] | null | undefined,
  now = Date.now(),
  range: DashboardUsageRange = '7d'
): DashboardTrendPoint[] {
  if (range !== '5h') {
    const days = range === '30d' ? 30 : DASHBOARD_TREND_DAYS;
    const trend = buildDashboardDailyTrend(timeline, now, days);
    if (range !== '30d') return trend;

    return trend.map((point, index) => ({
      ...point,
      label: index === 0 || index === trend.length - 1 || index % 5 === 0 ? point.label : '',
    }));
  }

  const rangeStart = now - getDashboardUsageRangeOption(range).durationMs;
  const firstHourStart = startOfLocalHour(rangeStart);
  const currentHourStart = startOfLocalHour(now);
  const buckets = new Map<number, number>();

  for (
    let bucketStartMs = firstHourStart;
    bucketStartMs <= currentHourStart;
    bucketStartMs += HOUR_MS
  ) {
    buckets.set(bucketStartMs, 0);
  }

  for (const point of timeline ?? []) {
    if (!Number.isFinite(point.bucket_ms)) continue;
    const hourStartMs = startOfLocalHour(point.bucket_ms);
    if (!buckets.has(hourStartMs)) continue;
    buckets.set(hourStartMs, (buckets.get(hourStartMs) ?? 0) + Math.max(0, point.calls || 0));
  }

  return Array.from(buckets.entries()).map(([hourStartMs, calls]) => ({
    dayStartMs: hourStartMs,
    label: formatDashboardHourLabel(hourStartMs),
    calls,
  }));
}
