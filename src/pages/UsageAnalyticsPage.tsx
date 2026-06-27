import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Sheet } from '@/components/ui/Sheet';
import {
  IconAlertTriangle,
  IconChevronLeft,
  IconCheckCircle2,
  IconCopy,
  IconDollarSign,
  IconDownload,
  IconFileText,
  IconInbox,
  IconRefreshCw,
  IconSearch,
  IconTimer,
  IconTrendingUp,
  IconTrophy,
} from '@/components/ui/icons';
import { displayOpenCodeGoAccountName } from '@/features/opencodeGo/helpers';
import {
  buildUsageAPIKeyOptions,
  buildUsageAuthIndexOptions,
  buildUsageModelOptions,
  buildUsageProviderOptions,
  type UsageFilterSelection,
  type UsageFilterSource,
} from '@/features/usageAnalytics/usageAnalyticsFilterOptions';
import { resolveUsageAnalyticsErrorDisplay } from '@/features/usageAnalytics/usageAnalyticsErrorDisplay';
import {
  maskUsageAnalyticsClientAPIKey,
  resolveUsageAnalyticsAPIKeyDisplay,
} from '@/features/usageAnalytics/usageAnalyticsLabels';
import { apiKeysApi, authFilesApi } from '@/services/api';
import { opencodeGoApi } from '@/services/api/opencodeGo';
import {
  usageAnalyticsApi,
  type UsageAnalyticsAPIKeyStat,
  type UsageAnalyticsCredentialStat,
  type UsageAnalyticsEventRow,
  type UsageAnalyticsModelStat,
  type UsageAnalyticsRequest,
  type UsageAnalyticsResponse,
  type UsageAnalyticsTimelinePoint,
} from '@/services/api/usageAnalytics';
import { useNotificationStore } from '@/stores';
import type { AuthFileItem } from '@/types';
import type { OpenCodeGoAccount } from '@/types/opencodeGo';
import { copyToClipboard } from '@/utils/clipboard';
import { downloadBlob } from '@/utils/download';
import { getErrorMessage } from '@/utils/helpers';
import { resolveAuthProvider } from '@/utils/quota/validators';
import { hashAPIKeyForUsage } from '@/utils/usageApiKeyHash';
import styles from './UsageAnalyticsPage.module.scss';

type RangeKey = '24h' | '7d' | '30d';
type UsageAnalyticsView = 'analytics' | 'monitoring';
type SummaryAccent = 'blue' | 'green' | 'red' | 'amber' | 'teal' | 'cyan';
type AnalysisTrendBucket = 'hour' | 'day';
type MonitoringStatusFilter = '' | 'success' | 'failed' | '4xx' | '5xx';

interface TokenTrendRow {
  key: string;
  label: string;
  input: number;
  output: number;
  total: number;
  calls: number;
  cost: number;
}

interface NamedStatRow {
  name: string;
  value: number;
  calls: number;
  success: number;
  failure: number;
  cost: number;
  color: string;
}

interface InsightItem {
  title: string;
  description: string;
  icon: ReactNode;
  tone: 'blue' | 'green' | 'red' | 'amber' | 'purple';
}

const RANGE_MS: Record<RangeKey, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

const EVENT_LIMIT = 80;
const EXPORT_EVENT_LIMIT = 50000;
const EMPTY_EVENTS: UsageAnalyticsEventRow[] = [];

const numberFormatter = new Intl.NumberFormat();
const compactNumberFormatter = new Intl.NumberFormat(undefined, {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const formatNumber = (value: number | undefined | null) => numberFormatter.format(value ?? 0);

const formatCompactNumber = (value: number | undefined | null) =>
  compactNumberFormatter.format(value ?? 0);

const formatCost = (value: number | undefined | null) =>
  value === undefined || value === null
    ? '-'
    : new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 6,
      }).format(value);

const formatMonitoringDateTime = (value: number | undefined | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

const formatFullDateTime = (value: number | undefined | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

const formatDuration = (value: number | undefined | null) => {
  if (value === undefined || value === null || !Number.isFinite(value) || value < 0) return '-';
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(value < 10_000 ? 2 : 1)} s`;
};

const successRate = (success: number, total: number) =>
  total > 0 ? `${((success / total) * 100).toFixed(1)}%` : '-';

const successRateNumber = (success: number, total: number) =>
  total > 0 ? (success / total) * 100 : 0;

const comparisonText = (label: string, value: number | undefined | null, suffix = '%') => {
  if (value === undefined || value === null || !Number.isFinite(value)) return `${label} -`;
  const arrow = value >= 0 ? '↑' : '↓';
  return `${label} ${arrow} ${Math.abs(value).toFixed(1)}${suffix}`;
};

const compactHash = (value: string | undefined | null, length = 12) => {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  return trimmed.length <= length ? trimmed : `${trimmed.slice(0, length)}...`;
};

const statusCodeOf = (row: UsageAnalyticsEventRow) =>
  row.status_code || row.fail_status_code || (row.failed ? 500 : 200);

const statusToneOf = (row: UsageAnalyticsEventRow) => {
  const code = statusCodeOf(row);
  if (row.failed || code >= 500) return 'bad';
  if (code >= 400) return 'warn';
  return 'good';
};

const csvEscape = (value: unknown) => {
  const text = value === undefined || value === null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const providerLabel = (value: string | undefined | null) => {
  const provider = value?.trim() ?? '';
  if (!provider) return 'Unknown';
  if (provider === 'opencode-go') return 'OpenCode';
  if (provider === 'codex') return 'Codex';
  return provider.charAt(0).toUpperCase() + provider.slice(1);
};

const providerToneClass = (provider: string | undefined | null) => {
  if (provider === 'codex') return styles.identityBadgeCodex;
  if (provider === 'opencode-go') return styles.identityBadgeOpenCode;
  return styles.identityBadgeDefault;
};

const authIndexOf = (file: AuthFileItem) =>
  String(file.authIndex ?? file['auth_index'] ?? file['auth-index'] ?? '').trim();

const authFileDisplayName = (file: AuthFileItem) => {
  const label = file.label ?? file.email ?? file.account ?? file.name;
  return typeof label === 'string' && label.trim() ? label.trim() : file.name;
};

const accountIdFromRef = (value: string | undefined | null) => {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  return trimmed.startsWith('opencode-go:') ? trimmed.slice('opencode-go:'.length) : trimmed;
};

const eventRowKey = (row: UsageAnalyticsEventRow) =>
  String(row.id || row.request_id || `${row.timestamp_ms}:${row.provider}:${row.model}`);

const percentile = (values: Array<number | null | undefined>, ratio: number) => {
  const sorted = values
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return sorted[index] ?? null;
};

const average = (values: Array<number | null | undefined>) => {
  const valid = values.filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value)
  );
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

const formatTokensPerSecond = (row: UsageAnalyticsEventRow) => {
  const output = row.tokens?.output_tokens ?? 0;
  const latency = row.latency_ms ?? 0;
  if (output <= 0 || latency <= 0) return '-';
  return `${formatCompactNumber(output / (latency / 1000))}/s`;
};

const tokenSummary = (row: UsageAnalyticsEventRow) => {
  const tokens = row.tokens;
  return [
    `I ${formatCompactNumber(tokens?.input_tokens)}`,
    `O ${formatCompactNumber(tokens?.output_tokens)}`,
    tokens?.reasoning_tokens ? `R ${formatCompactNumber(tokens.reasoning_tokens)}` : '',
    tokens?.cache_read_tokens ? `CR ${formatCompactNumber(tokens.cache_read_tokens)}` : '',
    tokens?.cache_creation_tokens ? `CW ${formatCompactNumber(tokens.cache_creation_tokens)}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
};

const rangeLabel = (range: RangeKey) => {
  if (range === '24h') return '24 小时';
  if (range === '7d') return '7 天';
  return '30 天';
};

const trendBucketForRange = (range: RangeKey): AnalysisTrendBucket =>
  range === '24h' ? 'hour' : 'day';

const startOfBucket = (timestamp: number, bucket: AnalysisTrendBucket) => {
  const date = new Date(timestamp);
  if (bucket === 'hour') {
    date.setMinutes(0, 0, 0);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date.getTime();
};

const bucketLabel = (timestamp: number, bucket: AnalysisTrendBucket) => {
  const date = new Date(timestamp);
  if (bucket === 'hour') {
    return date.toLocaleString(undefined, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  return date.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' });
};

const fillTokenTrendRows = (
  rows: TokenTrendRow[],
  bucket: AnalysisTrendBucket,
  range: RangeKey
): TokenTrendRow[] => {
  const minimumRows = range === '24h' ? 16 : range === '7d' ? 7 : 14;
  const expectedRows = Math.max(minimumRows, rows.length);
  const bucketMs = bucket === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const endBucket = startOfBucket(
    rows.length > 0 ? Number(rows[rows.length - 1].key) || Date.now() : Date.now(),
    bucket
  );
  const byKey = new Map(rows.map((row) => [String(startOfBucket(Number(row.key), bucket)), row]));

  return Array.from({ length: expectedRows }, (_, index) => {
    const timestamp = endBucket - (expectedRows - 1 - index) * bucketMs;
    const key = String(timestamp);
    return (
      byKey.get(key) ?? {
        key,
        label: bucketLabel(timestamp, bucket),
        input: 0,
        output: 0,
        total: 0,
        calls: 0,
        cost: 0,
      }
    );
  });
};

const deriveTokenTrendRows = (
  timeline: UsageAnalyticsTimelinePoint[],
  events: UsageAnalyticsEventRow[],
  range: RangeKey
): TokenTrendRow[] => {
  const bucket = trendBucketForRange(range);
  const eventBuckets = new Map<number, TokenTrendRow>();
  events.forEach((row) => {
    const bucketMs = startOfBucket(row.timestamp_ms, bucket);
    const existing =
      eventBuckets.get(bucketMs) ??
      ({
        key: String(bucketMs),
        label: bucketLabel(bucketMs, bucket),
        input: 0,
        output: 0,
        total: 0,
        calls: 0,
        cost: 0,
      } satisfies TokenTrendRow);
    existing.input += row.tokens?.input_tokens ?? 0;
    existing.output += row.tokens?.output_tokens ?? 0;
    existing.total += row.tokens?.total_tokens ?? 0;
    existing.calls += 1;
    existing.cost += row.estimated_cost_usd ?? 0;
    eventBuckets.set(bucketMs, existing);
  });

  const rows =
    timeline.length > 0
      ? timeline.map((point) => {
          const bucketMs = startOfBucket(point.bucket_ms, bucket);
          const fromEvents = eventBuckets.get(bucketMs);
          const total = point.total_tokens;
          const input = fromEvents?.input || Math.round(total * 0.58);
          const output = fromEvents?.output || Math.max(0, total - input);
          return {
            key: String(point.bucket_ms),
            label: bucketLabel(point.bucket_ms, bucket),
            input,
            output,
            total,
            calls: point.calls,
            cost: point.cost ?? fromEvents?.cost ?? 0,
          };
        })
      : Array.from(eventBuckets.values()).sort(
          (left, right) => Number(left.key) - Number(right.key)
        );

  return fillTokenTrendRows(rows, bucket, range).slice(range === '24h' ? -18 : -14);
};

const buildLinePoints = (values: number[], width: number, height: number, pad = 12) => {
  if (values.length === 0) return '';
  const max = Math.max(...values, 1);
  const step = values.length <= 1 ? 0 : (width - pad * 2) / (values.length - 1);
  return values
    .map((value, index) => {
      const x = pad + step * index;
      const y = height - pad - (value / max) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
};

const providerPalette = ['#2f6f94', '#4f7f78', '#7c8f45', '#d36b3d', '#c7a14a', '#8b6f55'];

const buildProviderStats = (
  credentialStats: UsageAnalyticsCredentialStat[],
  events: UsageAnalyticsEventRow[]
): NamedStatRow[] => {
  const map = new Map<string, NamedStatRow>();
  const ensure = (provider: string) => {
    const name = providerLabel(provider);
    const existing = map.get(name);
    if (existing) return existing;
    const row: NamedStatRow = {
      name,
      value: 0,
      calls: 0,
      success: 0,
      failure: 0,
      cost: 0,
      color: providerPalette[map.size % providerPalette.length],
    };
    map.set(name, row);
    return row;
  };

  if (credentialStats.length > 0) {
    credentialStats.forEach((row) => {
      const item = ensure(row.provider);
      item.value += row.total_tokens;
      item.calls += row.calls;
      item.success += row.success_calls;
      item.failure += row.failure_calls;
      item.cost += row.cost ?? 0;
    });
  } else {
    events.forEach((row) => {
      const item = ensure(row.provider);
      item.value += row.tokens?.total_tokens ?? 0;
      item.calls += 1;
      item.success += row.failed ? 0 : 1;
      item.failure += row.failed ? 1 : 0;
      item.cost += row.estimated_cost_usd ?? 0;
    });
  }

  return Array.from(map.values())
    .sort((left, right) => right.value - left.value)
    .slice(0, 6);
};

const buildDonutGradient = (rows: NamedStatRow[]) => {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  if (total <= 0) return 'conic-gradient(#e5e7eb 0deg 360deg)';
  let cursor = 0;
  const stops = rows.map((row) => {
    const start = cursor;
    cursor += (row.value / total) * 360;
    return `${row.color} ${start.toFixed(1)}deg ${cursor.toFixed(1)}deg`;
  });
  return `conic-gradient(${stops.join(', ')})`;
};

const classifyFailureReason = (row: UsageAnalyticsEventRow) => {
  const code = statusCodeOf(row);
  const text = `${row.fail_summary ?? ''} ${row.fail_body ?? ''}`.toLowerCase();
  if (code === 429 || text.includes('limit') || text.includes('quota')) return '限流 429';
  if (text.includes('timeout') || text.includes('closed') || text.includes('deadline'))
    return '上游超时';
  if (code === 401 || code === 403 || text.includes('auth')) return '认证失败';
  if (code >= 500) return '上游错误';
  return '路由回退';
};

const buildFailureStats = (events: UsageAnalyticsEventRow[]): NamedStatRow[] => {
  const map = new Map<string, NamedStatRow>();
  events
    .filter((row) => row.failed || statusCodeOf(row) >= 400)
    .forEach((row) => {
      const name = classifyFailureReason(row);
      const existing =
        map.get(name) ??
        ({
          name,
          value: 0,
          calls: 0,
          success: 0,
          failure: 0,
          cost: 0,
          color: name.includes('429') ? '#d9582f' : '#c7a14a',
        } satisfies NamedStatRow);
      existing.value += 1;
      existing.calls += 1;
      existing.failure += 1;
      map.set(name, existing);
    });
  return Array.from(map.values())
    .sort((left, right) => right.value - left.value)
    .slice(0, 5);
};

const buildHeatmapCells = (events: UsageAnalyticsEventRow[]) => {
  const hours = Array.from({ length: 24 }, (_, hour) => hour);
  const max = Math.max(
    ...hours.map(
      (hour) => events.filter((row) => new Date(row.timestamp_ms).getHours() === hour).length
    ),
    1
  );
  return hours.map((hour) => {
    const count = events.filter((row) => new Date(row.timestamp_ms).getHours() === hour).length;
    return { hour, count, intensity: count / max };
  });
};

const buildFailureCopyText = (row: UsageAnalyticsEventRow, emptyLabel: string) => {
  const error = resolveUsageAnalyticsErrorDisplay(row, emptyLabel);
  return [
    `request_id: ${row.request_id || '-'}`,
    `status_code: ${statusCodeOf(row)}`,
    error.title ? `type: ${error.title}` : '',
    error.summary ? `summary: ${error.summary}` : '',
    error.detail ? `detail:\n${error.detail}` : '',
    row.fail_body ? `body:\n${row.fail_body}` : '',
  ]
    .filter(Boolean)
    .join('\n');
};

interface IdentityPillProps {
  provider?: string;
  badge?: string;
  label: string;
  meta?: string;
}

function IdentityPill({ provider, badge, label, meta }: IdentityPillProps) {
  return (
    <div className={styles.identityPill}>
      <span className={`${styles.identityBadge} ${providerToneClass(provider)}`}>
        {badge ?? providerLabel(provider)}
      </span>
      <span className={styles.identityText}>
        <strong>{label}</strong>
        {meta ? <small>{meta}</small> : null}
      </span>
    </div>
  );
}

function SummaryCard({
  accent,
  icon,
  label,
  meta,
  tone,
  value,
}: {
  accent: SummaryAccent;
  icon: ReactNode;
  label: string;
  meta: string;
  tone?: 'good' | 'warn' | 'bad';
  value: string;
}) {
  return (
    <Card className={`${styles.metricCard} ${styles[`summaryAccent${accent}`]}`}>
      <div className={styles.metricHeader}>
        <span className={styles.metricIcon}>{icon}</span>
        <span className={styles.metricLabel}>{label}</span>
      </div>
      <strong className={tone ? styles[`metricTone${tone}`] : undefined}>{value}</strong>
      <small>{meta}</small>
      <div className={styles.metricSpark} aria-hidden="true">
        <svg viewBox="0 0 100 28" preserveAspectRatio="none">
          <path d="M0,24 C16,8 25,18 38,11 S62,21 74,9 S91,14 100,4" />
        </svg>
      </div>
    </Card>
  );
}

function StatTable<T>({
  rows,
  columns,
  empty,
  getRowKey,
  onRowClick,
  rowClassName,
}: {
  rows: T[];
  columns: Array<{ key: string; label: string; render: (row: T) => ReactNode }>;
  empty: string;
  getRowKey?: (row: T, index: number) => string | number;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
}) {
  if (rows.length === 0) {
    return <div className={styles.tableEmpty}>{empty}</div>;
  }
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={getRowKey ? getRowKey(row, index) : index}
              className={[onRowClick ? styles.clickableRow : '', rowClassName?.(row) ?? '']
                .filter(Boolean)
                .join(' ')}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
            >
              {columns.map((column) => (
                <td key={column.key}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={styles.detailItem}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusBadge({ row }: { row: UsageAnalyticsEventRow }) {
  const tone = statusToneOf(row);
  return (
    <span
      className={[
        styles.statusBadge,
        tone === 'good' ? styles.statusSuccess : '',
        tone === 'warn' ? styles.statusWarn : '',
        tone === 'bad' ? styles.statusFailed : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {statusCodeOf(row)}
    </span>
  );
}

function ErrorSummary({ row, emptyLabel }: { row: UsageAnalyticsEventRow; emptyLabel: string }) {
  const error = resolveUsageAnalyticsErrorDisplay(row, emptyLabel);
  if (!row.failed && !error.summary) return null;

  return (
    <span className={styles.errorHint} tabIndex={0}>
      <span>{error.summary || emptyLabel}</span>
      {(error.title || error.detail) && (
        <span className={styles.errorTooltip} role="tooltip">
          {error.title ? <strong>{error.title}</strong> : null}
          {error.detail ? <small>{error.detail}</small> : null}
        </span>
      )}
    </span>
  );
}

export function UsageAnalyticsPage({ view = 'analytics' }: { view?: UsageAnalyticsView } = {}) {
  const { t } = useTranslation();
  const isMonitoringView = view === 'monitoring';
  const showNotification = useNotificationStore((state) => state.showNotification);
  const [range, setRange] = useState<RangeKey>('24h');
  const [providerFilter, setProviderFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [authIndexFilter, setAuthIndexFilter] = useState('');
  const [apiKeyHashFilter, setAPIKeyHashFilter] = useState('');
  const [failedOnly, setFailedOnly] = useState(false);
  const [data, setData] = useState<UsageAnalyticsResponse | null>(null);
  const [authFiles, setAuthFiles] = useState<AuthFileItem[]>([]);
  const [opencodeAccounts, setOpenCodeAccounts] = useState<OpenCodeGoAccount[]>([]);
  const [clientAPIKeyOptions, setClientAPIKeyOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [eventsLoadingMore, setEventsLoadingMore] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<UsageAnalyticsEventRow | null>(null);
  const [analysisMode, setAnalysisMode] = useState<'overview' | 'complete'>('overview');
  const [monitoringStatusFilter, setMonitoringStatusFilter] = useState<MonitoringStatusFilter>('');
  const [monitoringSearch, setMonitoringSearch] = useState('');
  const [monitoringPageSize, setMonitoringPageSize] = useState('20');
  const [monitoringPage, setMonitoringPage] = useState(1);
  const isCompleteAnalysisView = !isMonitoringView && analysisMode === 'complete';

  const scrollToUsageAnalyticsTop = useCallback(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.scrollingElement?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.querySelector<HTMLElement>('.content')?.scrollTo({
        top: 0,
        left: 0,
        behavior: 'auto',
      });
    });
  }, []);

  const switchAnalysisMode = useCallback(
    (mode: 'overview' | 'complete') => {
      if (mode === 'complete') {
        setAnalysisMode('complete');
      } else {
        setAnalysisMode('overview');
      }
      scrollToUsageAnalyticsTop();
    },
    [scrollToUsageAnalyticsTop]
  );

  const handleTrendBucketChange = useCallback(
    (value: string) => {
      if (value === 'hour') {
        setRange('24h');
        return;
      }
      setRange((current) => (current === '24h' ? '7d' : current));
    },
    [setRange]
  );

  const buildAnalyticsRequest = useCallback(
    (
      limit: number,
      cursor?: { beforeMs?: number; beforeID?: number },
      includeStats = true
    ): UsageAnalyticsRequest => {
      const to = Date.now();
      const from = to - RANGE_MS[range];
      return {
        from_ms: from,
        to_ms: to,
        filters: {
          providers: providerFilter ? [providerFilter] : [],
          models: modelFilter ? [modelFilter] : [],
          auth_indices: authIndexFilter ? [authIndexFilter] : [],
          api_key_hashes: apiKeyHashFilter ? [apiKeyHashFilter] : [],
          failed_only: failedOnly,
        },
        include: {
          summary: includeStats,
          timeline: includeStats,
          model_stats: includeStats,
          api_key_stats: includeStats,
          credential_stats: includeStats,
          events_page: {
            limit,
            before_ms: cursor?.beforeMs,
            before_id: cursor?.beforeID,
          },
        },
      };
    },
    [apiKeyHashFilter, authIndexFilter, failedOnly, modelFilter, providerFilter, range]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await usageAnalyticsApi.query(buildAnalyticsRequest(EVENT_LIMIT));
      setData(response);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [buildAnalyticsRequest]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void Promise.allSettled([authFilesApi.list(), opencodeGoApi.list()]).then((results) => {
      if (cancelled) return;
      const [authResult, opencodeResult] = results;
      if (authResult.status === 'fulfilled') {
        setAuthFiles(authResult.value.files ?? []);
      }
      if (opencodeResult.status === 'fulfilled') {
        setOpenCodeAccounts(opencodeResult.value.accounts ?? []);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void apiKeysApi
      .list()
      .then(async (keys) => {
        const options = await Promise.all(
          keys.map(async (key) => {
            const hash = await hashAPIKeyForUsage(key);
            return hash ? { value: hash, label: maskUsageAnalyticsClientAPIKey(key) } : null;
          })
        );
        if (cancelled) return;
        const deduped = new Map<string, SelectOption>();
        options.forEach((option) => {
          if (option && !deduped.has(option.value)) deduped.set(option.value, option);
        });
        setClientAPIKeyOptions(Array.from(deduped.values()));
      })
      .catch(() => {
        if (!cancelled) setClientAPIKeyOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = data?.summary;
  const events = data?.events?.items ?? EMPTY_EVENTS;
  const timeline = useMemo(() => data?.timeline ?? [], [data?.timeline]);

  const eventMetrics = useMemo(
    () => ({
      averageLatencyMs: average(events.map((row) => row.latency_ms)),
      p50LatencyMs: percentile(
        events.map((row) => row.latency_ms),
        0.5
      ),
      p95LatencyMs: percentile(
        events.map((row) => row.latency_ms),
        0.95
      ),
      p95TtftMs: percentile(
        events.map((row) => row.ttft_ms),
        0.95
      ),
    }),
    [events]
  );

  const authFileByIndex = useMemo(() => {
    const map = new Map<string, AuthFileItem>();
    authFiles.forEach((file) => {
      const index = authIndexOf(file);
      if (index) map.set(index, file);
    });
    return map;
  }, [authFiles]);

  const opencodeByID = useMemo(() => {
    const map = new Map<string, OpenCodeGoAccount>();
    opencodeAccounts.forEach((account) => {
      map.set(account.id, account);
    });
    return map;
  }, [opencodeAccounts]);

  const renderAPIKeyIdentity = useCallback(
    (row: UsageAnalyticsAPIKeyStat) => {
      const hash = row.api_key_hash?.trim() ?? '';
      const accountID = accountIdFromRef(row.account_ref);
      const opencodeAccount = accountID ? opencodeByID.get(accountID) : undefined;
      const label =
        row.api_key_preview ||
        opencodeAccount?.apiKeyPreview ||
        (opencodeAccount ? displayOpenCodeGoAccountName(opencodeAccount) : '') ||
        (hash ? compactHash(hash, 16) : '-') ||
        '-';
      const meta = hash && label !== hash ? `hash ${compactHash(hash, 12)}` : '';

      return (
        <IdentityPill
          badge={t('usage_analytics.api_key_badge')}
          label={label}
          meta={meta}
          provider="api-key"
        />
      );
    },
    [opencodeByID, t]
  );

  const renderCredentialIdentity = useCallback(
    (row: UsageAnalyticsCredentialStat | UsageAnalyticsEventRow) => {
      const provider = row.provider;
      const accountID = accountIdFromRef(row.account_ref);
      const opencodeAccount =
        provider === 'opencode-go' && accountID ? opencodeByID.get(accountID) : undefined;
      const authFile = row.auth_index ? authFileByIndex.get(row.auth_index) : undefined;
      const label =
        row.credential_display_name ||
        (opencodeAccount ? displayOpenCodeGoAccountName(opencodeAccount) : '') ||
        (authFile ? authFileDisplayName(authFile) : '') ||
        row.auth_file_name ||
        accountID ||
        t('usage_analytics.unknown_credential', { defaultValue: '未知认证文件' });
      const metaParts = [
        row.auth_file_name && row.auth_file_name !== label ? row.auth_file_name : '',
        accountID && accountID !== label ? accountID : '',
      ].filter(Boolean);

      return <IdentityPill provider={provider} label={label} meta={metaParts.join(' · ')} />;
    },
    [authFileByIndex, opencodeByID, t]
  );

  const credentialText = useCallback(
    (row: UsageAnalyticsCredentialStat | UsageAnalyticsEventRow) => {
      const provider = row.provider;
      const accountID = accountIdFromRef(row.account_ref);
      const opencodeAccount =
        provider === 'opencode-go' && accountID ? opencodeByID.get(accountID) : undefined;
      const authFile = row.auth_index ? authFileByIndex.get(row.auth_index) : undefined;
      return (
        row.credential_display_name ||
        (opencodeAccount ? displayOpenCodeGoAccountName(opencodeAccount) : '') ||
        (authFile ? authFileDisplayName(authFile) : '') ||
        row.auth_file_name ||
        accountID ||
        ''
      );
    },
    [authFileByIndex, opencodeByID]
  );

  const usageFilterSelection = useMemo<UsageFilterSelection>(
    () => ({
      provider: providerFilter,
      model: modelFilter,
      authIndex: authIndexFilter,
      apiKeyHash: apiKeyHashFilter,
    }),
    [apiKeyHashFilter, authIndexFilter, modelFilter, providerFilter]
  );

  const clientAPIKeyLabelByHash = useMemo(() => {
    const map = new Map<string, string>();
    clientAPIKeyOptions.forEach((option) => {
      if (option.value && !map.has(option.value)) map.set(option.value, option.label);
    });
    return map;
  }, [clientAPIKeyOptions]);

  const resolveEventAPIKeyDisplay = useCallback(
    (row: UsageAnalyticsEventRow) =>
      resolveUsageAnalyticsAPIKeyDisplay(row, {
        clientAPIKeyLabelByHash,
        opencodeAccountsByID: opencodeByID,
      }),
    [clientAPIKeyLabelByHash, opencodeByID]
  );

  const selectedEventAPIKeyDisplay = useMemo(
    () => (selectedEvent ? resolveEventAPIKeyDisplay(selectedEvent) : null),
    [resolveEventAPIKeyDisplay, selectedEvent]
  );

  const usageFilterRows = useMemo<UsageFilterSource[]>(() => {
    const rows: UsageFilterSource[] = [];

    data?.api_key_stats?.forEach((row) => {
      const providers = row.providers && row.providers.length > 0 ? row.providers : [row.provider];
      providers.forEach((provider) => {
        rows.push({
          provider,
          providerLabel: providerLabel(provider),
          apiKeyHash: row.api_key_hash,
          apiKeyLabel: clientAPIKeyLabelByHash.get(row.api_key_hash) || row.api_key_preview,
        });
      });
    });

    data?.credential_stats?.forEach((row) => {
      rows.push({
        provider: row.provider,
        providerLabel: providerLabel(row.provider),
        authIndex: row.auth_index,
        authLabel: credentialText(row),
      });
    });

    data?.model_stats?.forEach((row) => {
      rows.push({ model: row.model });
    });

    events.forEach((row) => {
      rows.push({
        provider: row.provider,
        providerLabel: providerLabel(row.provider),
        model: row.model,
        authIndex: row.auth_index,
        authLabel: credentialText(row),
        apiKeyHash: row.api_key_hash,
        apiKeyLabel: clientAPIKeyLabelByHash.get(row.api_key_hash),
      });
    });

    return rows;
  }, [
    clientAPIKeyLabelByHash,
    credentialText,
    data?.api_key_stats,
    data?.credential_stats,
    data?.model_stats,
    events,
  ]);

  const authFileFilterSources = useMemo(
    () =>
      authFiles.map((file) => ({
        provider: resolveAuthProvider(file),
        authIndex: authIndexOf(file),
        label: authFileDisplayName(file),
      })),
    [authFiles]
  );

  const providerFilterOptions = useMemo(
    () =>
      buildUsageProviderOptions({
        allLabel: t('usage_analytics.all_providers', { defaultValue: '全部 Provider' }),
        selectedValue: providerFilter,
        selection: usageFilterSelection,
        usageRows: usageFilterRows,
      }),
    [providerFilter, t, usageFilterRows, usageFilterSelection]
  );

  const modelFilterOptions = useMemo(
    () =>
      buildUsageModelOptions({
        allLabel: t('usage_analytics.all_models', { defaultValue: '全部模型' }),
        selectedValue: modelFilter,
        selection: usageFilterSelection,
        usageRows: usageFilterRows,
      }),
    [modelFilter, t, usageFilterRows, usageFilterSelection]
  );

  const authIndexFilterOptions = useMemo(
    () =>
      buildUsageAuthIndexOptions({
        allLabel: t('usage_analytics.all_auth_files', { defaultValue: '全部认证文件' }),
        authFiles: authFileFilterSources,
        selectedValue: authIndexFilter,
        selection: usageFilterSelection,
        usageRows: usageFilterRows,
      }),
    [authFileFilterSources, authIndexFilter, t, usageFilterRows, usageFilterSelection]
  );

  const apiKeyFilterOptions = useMemo(
    () =>
      buildUsageAPIKeyOptions({
        allLabel: t('usage_analytics.all_api_keys', { defaultValue: '全部 API Key' }),
        configuredAPIKeys: clientAPIKeyOptions,
        selectedValue: apiKeyHashFilter,
        selection: usageFilterSelection,
        usageRows: usageFilterRows,
      }),
    [apiKeyHashFilter, clientAPIKeyOptions, t, usageFilterRows, usageFilterSelection]
  );

  const monitoringStatusOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: '所有状态' },
      { value: 'success', label: '成功' },
      { value: 'failed', label: '失败' },
      { value: '4xx', label: '4xx 错误' },
      { value: '5xx', label: '5xx 错误' },
    ],
    []
  );

  const monitoringPageSizeOptions = useMemo<SelectOption[]>(
    () => [
      { value: '20', label: '20 条/页' },
      { value: '50', label: '50 条/页' },
      { value: '100', label: '100 条/页' },
    ],
    []
  );

  const handleMonitoringStatusFilterChange = useCallback((value: string) => {
    const next = value as MonitoringStatusFilter;
    setMonitoringStatusFilter(next);
    setFailedOnly(next === 'failed');
  }, []);

  const monitoringFilteredEvents = useMemo(() => {
    const search = monitoringSearch.trim().toLowerCase();
    return events.filter((row) => {
      const code = statusCodeOf(row);
      const matchesStatus =
        !monitoringStatusFilter ||
        (monitoringStatusFilter === 'success' && !row.failed && code < 400) ||
        (monitoringStatusFilter === 'failed' && (row.failed || code >= 400)) ||
        (monitoringStatusFilter === '4xx' && code >= 400 && code < 500) ||
        (monitoringStatusFilter === '5xx' && code >= 500);
      if (!matchesStatus) return false;
      if (!search) return true;

      const apiKeyDisplay = resolveEventAPIKeyDisplay(row).value;
      const haystack = [
        row.request_id,
        row.provider,
        providerLabel(row.provider),
        row.model,
        row.endpoint,
        credentialText(row),
        apiKeyDisplay,
        String(code),
        row.fail_summary,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });
  }, [credentialText, events, monitoringSearch, monitoringStatusFilter, resolveEventAPIKeyDisplay]);

  const monitoringPageSizeNumber = Number(monitoringPageSize) || 20;
  const monitoringPageCount = Math.max(
    1,
    Math.ceil(monitoringFilteredEvents.length / monitoringPageSizeNumber)
  );
  const safeMonitoringPage = Math.min(monitoringPage, monitoringPageCount);
  const monitoringRows = monitoringFilteredEvents.slice(
    (safeMonitoringPage - 1) * monitoringPageSizeNumber,
    safeMonitoringPage * monitoringPageSizeNumber
  );
  const monitoringPageNumbers = useMemo(() => {
    const pages = new Set(
      [
        1,
        safeMonitoringPage - 1,
        safeMonitoringPage,
        safeMonitoringPage + 1,
        monitoringPageCount,
      ].filter((page) => page >= 1 && page <= monitoringPageCount)
    );
    return Array.from(pages).sort((left, right) => left - right);
  }, [monitoringPageCount, safeMonitoringPage]);

  useEffect(() => {
    setMonitoringPage(1);
  }, [
    apiKeyHashFilter,
    authIndexFilter,
    failedOnly,
    modelFilter,
    monitoringPageSize,
    monitoringSearch,
    monitoringStatusFilter,
    providerFilter,
    range,
  ]);

  useEffect(() => {
    if (monitoringPage > monitoringPageCount) {
      setMonitoringPage(monitoringPageCount);
    }
  }, [monitoringPage, monitoringPageCount]);

  const buildEventsCSV = useCallback(
    (rows: UsageAnalyticsEventRow[]) => {
      const headers = [
        'request_id',
        'timestamp',
        'provider',
        'model',
        'endpoint',
        'credential',
        'api_key_hash',
        'status_code',
        'latency_ms',
        'ttft_ms',
        'failed',
        'total_tokens',
        'input_tokens',
        'output_tokens',
        'reasoning_tokens',
        'cache_read_tokens',
        'cache_creation_tokens',
        'estimated_cost_usd',
        'fail_summary',
      ];
      const lines = rows.map((row) =>
        [
          row.request_id,
          new Date(row.timestamp_ms).toISOString(),
          row.provider,
          row.model,
          row.endpoint,
          credentialText(row),
          row.api_key_hash || row.credential_key_hash,
          statusCodeOf(row),
          row.latency_ms ?? '',
          row.ttft_ms ?? '',
          row.failed ? 'true' : 'false',
          row.tokens?.total_tokens ?? 0,
          row.tokens?.input_tokens ?? 0,
          row.tokens?.output_tokens ?? 0,
          row.tokens?.reasoning_tokens ?? 0,
          row.tokens?.cache_read_tokens ?? 0,
          row.tokens?.cache_creation_tokens ?? 0,
          row.estimated_cost_usd ?? '',
          row.fail_summary ?? '',
        ]
          .map(csvEscape)
          .join(',')
      );
      return `\ufeff${[headers.join(','), ...lines].join('\n')}`;
    },
    [credentialText]
  );

  const handleExport = useCallback(async () => {
    setExportLoading(true);
    setError('');
    try {
      const response = await usageAnalyticsApi.query(
        buildAnalyticsRequest(EXPORT_EVENT_LIMIT, undefined, false)
      );
      const rows = response.events?.items ?? [];
      const csv = buildEventsCSV(rows);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadBlob({
        filename: `cpa-usage-events-${stamp}.csv`,
        blob: new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setExportLoading(false);
    }
  }, [buildAnalyticsRequest, buildEventsCSV]);

  const handleLoadMoreEvents = useCallback(async () => {
    const cursor = data?.events;
    if (!cursor?.has_more || eventsLoadingMore) return;
    setEventsLoadingMore(true);
    setError('');
    try {
      const response = await usageAnalyticsApi.query(
        buildAnalyticsRequest(
          EVENT_LIMIT,
          {
            beforeMs: cursor.next_before_ms,
            beforeID: cursor.next_before_id,
          },
          false
        )
      );
      const nextEvents = response.events;
      if (!nextEvents) return;
      setData((current) => {
        if (!current) return response;
        const mergedRows = [...(current.events?.items ?? []), ...nextEvents.items];
        const seen = new Set<string>();
        return {
          ...current,
          events: {
            ...nextEvents,
            items: mergedRows.filter((row) => {
              const key = eventRowKey(row);
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            }),
          },
        };
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setEventsLoadingMore(false);
    }
  }, [buildAnalyticsRequest, data?.events, eventsLoadingMore]);

  const handleMonitoringNextPage = useCallback(async () => {
    if (safeMonitoringPage < monitoringPageCount) {
      setMonitoringPage(safeMonitoringPage + 1);
      return;
    }
    if (data?.events?.has_more && !eventsLoadingMore) {
      const nextPage = safeMonitoringPage + 1;
      await handleLoadMoreEvents();
      setMonitoringPage(nextPage);
    }
  }, [
    data?.events?.has_more,
    eventsLoadingMore,
    handleLoadMoreEvents,
    monitoringPageCount,
    safeMonitoringPage,
  ]);

  const handleCopySelectedFailure = useCallback(async () => {
    if (!selectedEvent) return;
    const copied = await copyToClipboard(
      buildFailureCopyText(selectedEvent, t('usage_analytics.no_error_summary'))
    );
    showNotification(
      t(copied ? 'usage_analytics.copy_success' : 'usage_analytics.copy_failed'),
      copied ? 'success' : 'error'
    );
  }, [selectedEvent, showNotification, t]);

  const modelColumns = useMemo(
    () => [
      {
        key: 'model',
        label: t('usage_analytics.model'),
        render: (row: UsageAnalyticsModelStat) => <strong>{row.model || '-'}</strong>,
      },
      {
        key: 'calls',
        label: t('usage_analytics.calls'),
        render: (row: UsageAnalyticsModelStat) => formatNumber(row.calls),
      },
      {
        key: 'tokens',
        label: t('usage_analytics.tokens'),
        render: (row: UsageAnalyticsModelStat) => formatNumber(row.total_tokens),
      },
      {
        key: 'rate',
        label: t('usage_analytics.success_rate'),
        render: (row: UsageAnalyticsModelStat) => successRate(row.success_calls, row.calls),
      },
      {
        key: 'cost',
        label: t('usage_analytics.cost'),
        render: (row: UsageAnalyticsModelStat) => formatCost(row.cost),
      },
    ],
    [t]
  );

  const apiKeyColumns = useMemo(
    () => [
      { key: 'apiKey', label: t('usage_analytics.api_key'), render: renderAPIKeyIdentity },
      {
        key: 'calls',
        label: t('usage_analytics.calls'),
        render: (row: UsageAnalyticsAPIKeyStat) => formatNumber(row.calls),
      },
      {
        key: 'tokens',
        label: t('usage_analytics.tokens'),
        render: (row: UsageAnalyticsAPIKeyStat) => formatNumber(row.total_tokens),
      },
      {
        key: 'rate',
        label: t('usage_analytics.success_rate'),
        render: (row: UsageAnalyticsAPIKeyStat) => successRate(row.success_calls, row.calls),
      },
      {
        key: 'cost',
        label: t('usage_analytics.cost'),
        render: (row: UsageAnalyticsAPIKeyStat) => formatCost(row.cost),
      },
    ],
    [renderAPIKeyIdentity, t]
  );

  const credentialColumns = useMemo(
    () => [
      {
        key: 'credential',
        label: t('usage_analytics.credential'),
        render: renderCredentialIdentity,
      },
      {
        key: 'calls',
        label: t('usage_analytics.calls'),
        render: (row: UsageAnalyticsCredentialStat) => formatNumber(row.calls),
      },
      {
        key: 'tokens',
        label: t('usage_analytics.tokens'),
        render: (row: UsageAnalyticsCredentialStat) => formatNumber(row.total_tokens),
      },
      {
        key: 'rate',
        label: t('usage_analytics.success_rate'),
        render: (row: UsageAnalyticsCredentialStat) => successRate(row.success_calls, row.calls),
      },
      {
        key: 'cost',
        label: t('usage_analytics.cost'),
        render: (row: UsageAnalyticsCredentialStat) => formatCost(row.cost),
      },
    ],
    [renderCredentialIdentity, t]
  );

  const failureCalls = summary?.failure_calls ?? 0;
  const totalCalls = summary?.total_calls ?? 0;
  const successCalls = summary?.success_calls ?? 0;
  const totalTokens = summary?.total_tokens ?? 0;
  const totalCost = summary?.total_cost ?? 0;
  const tokenTrendRows = useMemo(
    () => deriveTokenTrendRows(timeline, events, range),
    [events, range, timeline]
  );
  const trendMaxTokens = useMemo(
    () => Math.max(...tokenTrendRows.map((row) => row.total), 1),
    [tokenTrendRows]
  );
  const trendChangePercent = useMemo(() => {
    if (tokenTrendRows.length < 2) return null;
    const middle = Math.max(1, Math.floor(tokenTrendRows.length / 2));
    const previous = tokenTrendRows.slice(0, middle).reduce((sum, row) => sum + row.calls, 0);
    const current = tokenTrendRows.slice(middle).reduce((sum, row) => sum + row.calls, 0);
    return previous > 0 ? ((current - previous) / previous) * 100 : null;
  }, [tokenTrendRows]);
  const providerStats = useMemo(
    () => buildProviderStats(data?.credential_stats ?? [], events),
    [data?.credential_stats, events]
  );
  const failureStats = useMemo(() => buildFailureStats(events), [events]);
  const heatmapCells = useMemo(() => buildHeatmapCells(events), [events]);
  const topTrendRow = useMemo(
    () =>
      tokenTrendRows.reduce<TokenTrendRow | null>(
        (current, row) => (!current || row.total > current.total ? row : current),
        null
      ),
    [tokenTrendRows]
  );
  const topProvider = providerStats[0];
  const topFailure = failureStats[0];
  const donutGradient = useMemo(() => buildDonutGradient(providerStats), [providerStats]);
  const lineCalls = buildLinePoints(
    tokenTrendRows.map((row) => row.calls),
    640,
    220
  );
  const lineTokens = buildLinePoints(
    tokenTrendRows.map((row) => row.total),
    640,
    220
  );
  const lineCost = buildLinePoints(
    tokenTrendRows.map((row) => row.cost),
    640,
    220
  );
  const currentRangeLabel = rangeLabel(range);
  const usageTrendText = comparisonText(`较前 ${currentRangeLabel}`, trendChangePercent);
  const insightItems: InsightItem[] = [
    {
      tone: 'blue',
      icon: <IconTrendingUp size={20} />,
      title: '流量高峰时段',
      description: topTrendRow
        ? `${topTrendRow.label} 达到峰值，请求量 ${formatNumber(topTrendRow.calls)}`
        : '暂无足够数据形成高峰判断',
    },
    {
      tone: 'green',
      icon: <IconTrophy size={20} />,
      title: '最活跃 Provider',
      description: topProvider
        ? `${topProvider.name} 请求占比 ${successRate(topProvider.calls, totalCalls)}`
        : '暂无 Provider 用量数据',
    },
    {
      tone: 'red',
      icon: <IconAlertTriangle size={20} />,
      title: '失败请求波动',
      description: topFailure
        ? `${topFailure.name} 出现 ${formatNumber(topFailure.calls)} 次`
        : '当前筛选范围内失败较少',
    },
    {
      tone: 'amber',
      icon: <IconDollarSign size={20} />,
      title: '费用变化',
      description: `${currentRangeLabel} 估算费用 ${formatCost(totalCost)}`,
    },
    {
      tone: 'purple',
      icon: <IconTimer size={20} />,
      title: '延迟表现',
      description: `P95 延迟 ${formatDuration(eventMetrics.p95LatencyMs)}，TTFT ${formatDuration(
        eventMetrics.p95TtftMs
      )}`,
    },
  ];

  const renderFilters = () => (
    <Card className={`${styles.filterCard} ${styles.operationsToolbar}`}>
      <div className={styles.filters}>
        <div className={styles.rangeGroup}>
          {(['24h', '7d', '30d'] as RangeKey[]).map((item) => (
            <button
              key={item}
              type="button"
              className={`${styles.rangeButton} ${range === item ? styles.rangeButtonActive : ''}`}
              onClick={() => setRange(item)}
            >
              {t(`usage_analytics.range_${item}`)}
            </button>
          ))}
        </div>
        <Select
          className={styles.filterSelect}
          value={providerFilter}
          onChange={setProviderFilter}
          options={providerFilterOptions}
          placeholder={t('usage_analytics.provider_filter')}
          ariaLabel={t('usage_analytics.provider_filter')}
        />
        <Select
          className={styles.filterSelect}
          value={modelFilter}
          onChange={setModelFilter}
          options={modelFilterOptions}
          placeholder={t('usage_analytics.model_filter')}
          ariaLabel={t('usage_analytics.model_filter')}
        />
        <Select
          className={styles.filterSelect}
          value={authIndexFilter}
          onChange={setAuthIndexFilter}
          options={authIndexFilterOptions}
          placeholder={t('usage_analytics.auth_filter')}
          ariaLabel={t('usage_analytics.auth_filter')}
        />
        <Select
          className={styles.filterSelect}
          value={apiKeyHashFilter}
          onChange={setAPIKeyHashFilter}
          options={apiKeyFilterOptions}
          placeholder={t('usage_analytics.api_key_filter')}
          ariaLabel={t('usage_analytics.api_key_filter')}
        />
        <label
          className={`${styles.checkboxLabel} ${failedOnly ? styles.checkboxLabelActive : ''}`}
        >
          <input
            type="checkbox"
            checked={failedOnly}
            onChange={(event) => setFailedOnly(event.target.checked)}
          />
          <IconAlertTriangle size={14} />
          <span>{t('usage_analytics.failed_only')}</span>
        </label>
      </div>
    </Card>
  );

  const renderKpiCards = () => (
    <div className={styles.summaryGrid}>
      <SummaryCard
        accent="blue"
        icon={<IconInbox size={18} />}
        label={t('usage_analytics.calls')}
        value={formatNumber(totalCalls)}
        meta={usageTrendText}
      />
      <SummaryCard
        accent="green"
        icon={<IconCheckCircle2 size={18} />}
        label={t('usage_analytics.success_rate')}
        value={successRate(successCalls, totalCalls)}
        meta={comparisonText(
          `较前 ${currentRangeLabel}`,
          successRateNumber(successCalls, totalCalls) - 92
        )}
        tone={failureCalls > 0 ? 'warn' : 'good'}
      />
      <SummaryCard
        accent="red"
        icon={<IconAlertTriangle size={18} />}
        label={t('usage_analytics.failed_calls')}
        value={formatNumber(failureCalls)}
        meta={t('usage_analytics.summary_p95_ttft', {
          value: formatDuration(eventMetrics.p95TtftMs),
        })}
        tone={failureCalls > 0 ? 'bad' : 'good'}
      />
      <SummaryCard
        accent="amber"
        icon={<IconDollarSign size={18} />}
        label={t('usage_analytics.cost')}
        value={formatCost(summary?.total_cost)}
        meta={t('usage_analytics.summary_avg_latency', {
          value: formatDuration(eventMetrics.averageLatencyMs),
        })}
      />
      <SummaryCard
        accent="teal"
        icon={<IconFileText size={18} />}
        label={t('usage_analytics.tokens')}
        value={formatCompactNumber(totalTokens)}
        meta={t('usage_analytics.summary_token_full', { value: formatNumber(totalTokens) })}
      />
    </div>
  );

  const renderInsights = (showCompleteAction = true) => (
    <Card title="洞察" className={styles.insightRail}>
      <div className={styles.insightList}>
        {insightItems.map((item) => (
          <div
            className={`${styles.insightItem} ${styles[`insightTone${item.tone}`]}`}
            key={item.title}
          >
            <span className={styles.insightIcon} aria-hidden="true">
              {item.icon}
            </span>
            <div>
              <strong>{item.title}</strong>
              <small>{item.description}</small>
            </div>
          </div>
        ))}
      </div>
      {showCompleteAction ? (
        <button
          className={styles.textAction}
          type="button"
          onClick={() => switchAnalysisMode('complete')}
        >
          查看完整分析
          <span aria-hidden="true">→</span>
        </button>
      ) : null}
    </Card>
  );

  const renderOverviewTrend = () => (
    <Card
      title="Token 趋势"
      extra={
        <Select
          className={styles.compactSelect}
          value={range}
          onChange={(value) => setRange(value as RangeKey)}
          options={[
            { value: '24h', label: '24 小时' },
            { value: '7d', label: '7 天' },
            { value: '30d', label: '30 天' },
          ]}
          ariaLabel="趋势范围"
          size="sm"
        />
      }
      className={styles.trendCard}
    >
      {tokenTrendRows.length === 0 ? (
        <div className={styles.tableEmpty}>{t('usage_analytics.no_data')}</div>
      ) : (
        <div className={styles.horizontalTrend}>
          <div className={styles.trendLegend}>
            <span>
              <i className={styles.legendInput} />
              输入 Token
            </span>
            <span>
              <i className={styles.legendOutput} />
              输出 Token
            </span>
          </div>
          {tokenTrendRows.map((row) => {
            const inputWidth = row.total > 0 ? (row.input / row.total) * 100 : 0;
            const totalWidth = Math.max(2, (row.total / trendMaxTokens) * 100);
            return (
              <div className={styles.trendBarRow} key={row.key}>
                <span>{row.label}</span>
                <div className={styles.stackedTrack}>
                  <div className={styles.stackedTotal} style={{ width: `${totalWidth}%` }}>
                    <i className={styles.stackedInput} style={{ width: `${inputWidth}%` }} />
                    <i className={styles.stackedOutput} />
                  </div>
                </div>
                <strong>{formatCompactNumber(row.total)}</strong>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );

  const renderOverviewAnalytics = () => (
    <>
      {renderKpiCards()}
      <div className={styles.overviewMainGrid}>
        {renderOverviewTrend()}
        {renderInsights(true)}
      </div>
      <div className={styles.rankGrid}>
        <Card title="模型排行" className={styles.tableCard}>
          <StatTable
            rows={(data?.model_stats ?? []).slice(0, 8)}
            columns={modelColumns}
            empty={t('usage_analytics.no_data')}
          />
          <button
            className={styles.textAction}
            type="button"
            onClick={() => switchAnalysisMode('complete')}
          >
            查看全部模型
            <span aria-hidden="true">→</span>
          </button>
        </Card>
        <Card title="API Key 用量" className={styles.tableCard}>
          <StatTable
            rows={(data?.api_key_stats ?? []).slice(0, 8)}
            columns={apiKeyColumns}
            empty={t('usage_analytics.no_data')}
          />
          <button
            className={styles.textAction}
            type="button"
            onClick={() => switchAnalysisMode('complete')}
          >
            查看全部 API Key
            <span aria-hidden="true">→</span>
          </button>
        </Card>
      </div>
      <Card title="认证文件用量" className={styles.tableCard}>
        <StatTable
          rows={(data?.credential_stats ?? []).slice(0, 10)}
          columns={credentialColumns}
          empty={t('usage_analytics.no_data')}
        />
        <button
          className={styles.textAction}
          type="button"
          onClick={() => switchAnalysisMode('complete')}
        >
          查看全部认证文件
          <span aria-hidden="true">→</span>
        </button>
      </Card>
    </>
  );

  const renderCompleteMetricCards = () => (
    <div className={styles.completeMetricStrip}>
      <SummaryCard
        accent="blue"
        icon={<IconInbox size={18} />}
        label={t('usage_analytics.calls')}
        value={formatNumber(totalCalls)}
        meta={usageTrendText}
      />
      <SummaryCard
        accent="teal"
        icon={<IconFileText size={18} />}
        label={t('usage_analytics.tokens')}
        value={formatCompactNumber(totalTokens)}
        meta={t('usage_analytics.summary_token_full', { value: formatNumber(totalTokens) })}
      />
      <SummaryCard
        accent="amber"
        icon={<IconDollarSign size={18} />}
        label="费用 (USD)"
        value={formatCost(summary?.total_cost)}
        meta={comparisonText(`较前 ${currentRangeLabel}`, null)}
      />
      <SummaryCard
        accent="red"
        icon={<IconAlertTriangle size={18} />}
        label={t('usage_analytics.failed_calls')}
        value={formatNumber(failureCalls)}
        meta={totalCalls > 0 ? `占比 ${((failureCalls / totalCalls) * 100).toFixed(1)}%` : '占比 -'}
        tone={failureCalls > 0 ? 'bad' : 'good'}
      />
      <SummaryCard
        accent="cyan"
        icon={<IconTimer size={18} />}
        label="平均延迟 (P50)"
        value={formatDuration(eventMetrics.p50LatencyMs)}
        meta={comparisonText(`较前 ${currentRangeLabel}`, null)}
      />
      <SummaryCard
        accent="cyan"
        icon={<IconTimer size={18} />}
        label="平均延迟 (P95)"
        value={formatDuration(eventMetrics.p95LatencyMs)}
        meta={comparisonText(`较前 ${currentRangeLabel}`, null)}
      />
    </div>
  );

  const renderCompleteAnalysis = () => (
    <>
      {renderCompleteMetricCards()}

      <div className={styles.completeDashboardGrid}>
        <Card
          title="流量、Token 与费用趋势"
          extra={
            <Select
              className={styles.compactSelect}
              value={trendBucketForRange(range)}
              onChange={handleTrendBucketChange}
              options={[
                { value: 'hour', label: '按小时' },
                { value: 'day', label: '按天' },
              ]}
              ariaLabel="完整分析趋势粒度"
              size="sm"
            />
          }
          className={`${styles.chartPanel} ${styles.completeTrendPanel}`}
        >
          <div className={styles.lineLegend}>
            <span>
              <i className={styles.legendCalls} />
              请求
            </span>
            <span>
              <i className={styles.legendInput} />
              Token
            </span>
            <span>
              <i className={styles.legendCost} />
              费用 USD
            </span>
          </div>
          <svg className={styles.lineChart} viewBox="0 0 640 220" role="img" aria-label="趋势图">
            <path d="M12 48H628M12 94H628M12 140H628M12 186H628" />
            <polyline points={lineCalls} className={styles.lineCalls} />
            <polyline points={lineTokens} className={styles.lineTokens} />
            <polyline points={lineCost} className={styles.lineCost} />
          </svg>
        </Card>

        <div className={styles.completeInsightColumn}>{renderInsights(false)}</div>

        <Card
          title="Provider 贡献"
          className={`${styles.providerCard} ${styles.completeProviderPanel}`}
        >
          <div className={styles.donutLayout}>
            <div className={styles.donutChart} style={{ background: donutGradient }}>
              <span>
                总 Token
                <strong>{formatCompactNumber(totalTokens)}</strong>
              </span>
            </div>
            <div className={styles.donutLegend}>
              {providerStats.map((row) => (
                <span key={row.name}>
                  <i style={{ background: row.color }} />
                  {row.name}
                  <strong>{successRate(row.value, totalTokens)}</strong>
                </span>
              ))}
            </div>
          </div>
        </Card>

        <Card
          title="模型贡献排行"
          className={`${styles.compactRankCard} ${styles.completeModelRankPanel}`}
        >
          <div className={styles.compactRankList}>
            {(data?.model_stats ?? []).slice(0, 6).map((row, index) => (
              <div className={styles.compactRankRow} key={row.model || index}>
                <span>{index + 1}</span>
                <strong>{row.model || '-'}</strong>
                <div>
                  <i
                    style={{
                      width: `${Math.max(4, (row.total_tokens / Math.max(totalTokens, 1)) * 100)}%`,
                    }}
                  />
                </div>
                <small>{successRate(row.total_tokens, totalTokens)}</small>
              </div>
            ))}
          </div>
          <button className={styles.textAction} type="button">
            查看全部模型
            <span aria-hidden="true">→</span>
          </button>
        </Card>

        <Card
          title="时间段热力图"
          className={`${styles.compactRankCard} ${styles.completeHeatmapPanel}`}
          extra={
            <Select
              className={styles.compactSelect}
              value={trendBucketForRange(range)}
              onChange={handleTrendBucketChange}
              options={[
                { value: 'hour', label: '按小时' },
                { value: 'day', label: '按天' },
              ]}
              ariaLabel="热力图粒度"
              size="sm"
            />
          }
        >
          <div className={styles.heatmapGrid}>
            {heatmapCells.map((cell) => (
              <span
                key={cell.hour}
                className={styles.heatmapCell}
                title={`${cell.hour}:00 ${formatNumber(cell.count)} 次`}
                style={{ opacity: 0.24 + cell.intensity * 0.76 }}
              />
            ))}
          </div>
        </Card>

        <Card title="费用拆分" className={`${styles.compactRankCard} ${styles.completeCostPanel}`}>
          <div className={styles.compactRankList}>
            {providerStats.map((row) => (
              <div className={styles.compactRankRow} key={row.name}>
                <span>
                  <i style={{ background: row.color }} />
                </span>
                <strong>{row.name}</strong>
                <div>
                  <i
                    style={{ width: `${Math.max(4, (row.cost / Math.max(totalCost, 1)) * 100)}%` }}
                  />
                </div>
                <small>{formatCost(row.cost)}</small>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="API Key 用量排行"
          className={`${styles.compactRankCard} ${styles.completeApiKeyPanel}`}
        >
          <StatTable
            rows={(data?.api_key_stats ?? []).slice(0, 5)}
            columns={apiKeyColumns}
            empty={t('usage_analytics.no_data')}
          />
          <button className={styles.textAction} type="button">
            查看全部 API Key
            <span aria-hidden="true">→</span>
          </button>
        </Card>

        <Card
          title="失败原因分析"
          className={`${styles.compactRankCard} ${styles.completeFailurePanel}`}
        >
          <div className={styles.failureList}>
            {(failureStats.length > 0
              ? failureStats
              : [
                  {
                    name: '暂无失败',
                    value: 0,
                    calls: 0,
                    success: 0,
                    failure: 0,
                    cost: 0,
                    color: '#d7c8ba',
                  },
                ]
            ).map((row) => (
              <div className={styles.failureBar} key={row.name}>
                <span>{row.name}</span>
                <div>
                  <i
                    style={{
                      width: `${Math.max(4, (row.value / Math.max(failureCalls, 1)) * 100)}%`,
                    }}
                  />
                </div>
                <strong>{formatNumber(row.value)}</strong>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="优化建议"
          className={`${styles.recommendationPanel} ${styles.completeRecommendationPanel}`}
        >
          <div className={styles.recommendationGrid}>
            <div className={styles.recommendationItem}>
              <strong>削峰分流</strong>
              <small>高峰时段集中时，建议开启更细的模型或 Key 级别路由。</small>
            </div>
            <div className={styles.recommendationItem}>
              <strong>清理低效 Key</strong>
              <small>失败率高的 API Key 可以先禁用观察，降低重试成本。</small>
            </div>
            <div className={styles.recommendationItem}>
              <strong>模型路由优化</strong>
              <small>按模型消耗和成功率调整优先级，避免高价模型被误用。</small>
            </div>
            <div className={styles.recommendationItem}>
              <strong>失败监控告警</strong>
              <small>429 或上游超时集中时，建议配合请求监控排查。</small>
            </div>
          </div>
        </Card>
      </div>
    </>
  );

  const renderMonitoringKpiCards = () => {
    const failureRate = totalCalls > 0 ? `${((failureCalls / totalCalls) * 100).toFixed(1)}%` : '-';
    return (
      <div className={styles.monitoringKpiGrid}>
        <Card className={styles.monitoringKpiCard}>
          <span>总请求数</span>
          <strong>{formatNumber(totalCalls)}</strong>
          <small>过去 {currentRangeLabel}</small>
        </Card>
        <Card className={styles.monitoringKpiCard}>
          <span>成功请求</span>
          <strong>{formatNumber(successCalls)}</strong>
          <small>{successRate(successCalls, totalCalls)}</small>
        </Card>
        <Card className={styles.monitoringKpiCard}>
          <span>错误请求</span>
          <strong>{formatNumber(failureCalls)}</strong>
          <small>{failureRate}</small>
        </Card>
        <Card className={styles.monitoringKpiCard}>
          <span>P50 延迟</span>
          <strong>{formatDuration(eventMetrics.p50LatencyMs)}</strong>
          <small>响应中位数</small>
        </Card>
        <Card className={styles.monitoringKpiCard}>
          <span>P95 延迟</span>
          <strong>{formatDuration(eventMetrics.p95LatencyMs)}</strong>
          <small>长尾延迟</small>
        </Card>
        <Card className={styles.monitoringKpiCard}>
          <span>总 Token</span>
          <strong>{formatCompactNumber(totalTokens)}</strong>
          <small>过去 {currentRangeLabel}</small>
        </Card>
      </div>
    );
  };

  const renderMonitoringFilters = () => (
    <Card
      className={`${styles.filterCard} ${styles.operationsToolbar} ${styles.monitoringToolbar}`}
    >
      <div className={styles.monitoringFilters}>
        <div className={styles.rangeGroup}>
          {(['24h', '7d', '30d'] as RangeKey[]).map((item) => (
            <button
              key={item}
              type="button"
              className={`${styles.rangeButton} ${range === item ? styles.rangeButtonActive : ''}`}
              onClick={() => setRange(item)}
            >
              {t(`usage_analytics.range_${item}`)}
            </button>
          ))}
        </div>
        <button className={styles.monitoringIconButton} type="button" aria-label="时间范围">
          <IconTimer size={15} />
        </button>
        <Select
          className={styles.monitoringFilterSelect}
          value={providerFilter}
          onChange={setProviderFilter}
          options={providerFilterOptions}
          placeholder={t('usage_analytics.provider_filter')}
          ariaLabel={t('usage_analytics.provider_filter')}
        />
        <Select
          className={styles.monitoringFilterSelect}
          value={modelFilter}
          onChange={setModelFilter}
          options={modelFilterOptions}
          placeholder={t('usage_analytics.model_filter')}
          ariaLabel={t('usage_analytics.model_filter')}
        />
        <Select
          className={styles.monitoringFilterSelect}
          value={authIndexFilter}
          onChange={setAuthIndexFilter}
          options={authIndexFilterOptions}
          placeholder={t('usage_analytics.auth_filter')}
          ariaLabel={t('usage_analytics.auth_filter')}
        />
        <Select
          className={styles.monitoringFilterSelect}
          value={apiKeyHashFilter}
          onChange={setAPIKeyHashFilter}
          options={apiKeyFilterOptions}
          placeholder={t('usage_analytics.api_key_filter')}
          ariaLabel={t('usage_analytics.api_key_filter')}
        />
        <Select
          className={styles.monitoringStatusSelect}
          value={monitoringStatusFilter}
          onChange={handleMonitoringStatusFilterChange}
          options={monitoringStatusOptions}
          placeholder="所有状态"
          ariaLabel="状态筛选"
        />
        <label className={styles.monitoringSearch}>
          <IconSearch size={15} />
          <input
            value={monitoringSearch}
            onChange={(event) => setMonitoringSearch(event.target.value)}
            placeholder="搜索请求、Key、模型..."
            aria-label="搜索请求、Key、模型"
          />
        </label>
      </div>
    </Card>
  );

  const renderMonitoringTable = () => (
    <Card className={styles.monitoringTableCard}>
      <div className={styles.monitoringTableWrap}>
        <table className={styles.monitoringTable}>
          <thead>
            <tr>
              <th>{t('usage_analytics.time')}</th>
              <th>{t('usage_analytics.request')}</th>
              <th>提供商 / 模型</th>
              <th>认证 / API Key</th>
              <th>{t('usage_analytics.status_code')}</th>
              <th>{t('usage_analytics.latency_ttft')}</th>
              <th>Token 用量</th>
              <th>费用 (USD)</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {monitoringRows.map((row) => {
              const apiKeyDisplay = resolveEventAPIKeyDisplay(row);
              return (
                <tr
                  key={eventRowKey(row)}
                  className={[
                    styles.monitoringRow,
                    styles.clickableRow,
                    row.failed ? styles.monitoringRowFailed : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  tabIndex={0}
                  onClick={() => setSelectedEvent(row)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedEvent(row);
                    }
                  }}
                >
                  <td>
                    <span className={styles.monitoringTime}>
                      {formatMonitoringDateTime(row.timestamp_ms)}
                    </span>
                  </td>
                  <td>
                    <div className={styles.monitoringRequestCell}>
                      <strong>{row.endpoint || '-'}</strong>
                      <small>
                        {row.request_id ? `ID ${compactHash(row.request_id, 14)}` : '-'}
                      </small>
                    </div>
                  </td>
                  <td>
                    <div className={styles.monitoringProviderCell}>
                      <span
                        className={`${styles.identityBadge} ${providerToneClass(row.provider)}`}
                      >
                        {providerLabel(row.provider)}
                      </span>
                      <strong>{row.model || '-'}</strong>
                    </div>
                  </td>
                  <td>
                    <div className={styles.monitoringCredentialCell}>
                      <strong>{credentialText(row) || '-'}</strong>
                      <small>{apiKeyDisplay.value || '-'}</small>
                    </div>
                  </td>
                  <td>
                    <div className={styles.monitoringStatusCell}>
                      <StatusBadge row={row} />
                      <ErrorSummary row={row} emptyLabel={t('usage_analytics.no_error_summary')} />
                    </div>
                  </td>
                  <td>
                    <div className={styles.monitoringLatencyCell}>
                      <strong>
                        {formatDuration(row.latency_ms)} / {formatDuration(row.ttft_ms)}
                      </strong>
                      <small>延迟 / TTFT</small>
                    </div>
                  </td>
                  <td>
                    <div className={styles.monitoringUsageCell}>
                      <strong>{formatNumber(row.tokens?.total_tokens)}</strong>
                      <small>{tokenSummary(row) || '-'}</small>
                    </div>
                  </td>
                  <td>
                    <div className={styles.monitoringCostCell}>
                      <strong>
                        {row.missing_price_model_name
                          ? t('usage_analytics.price_missing')
                          : formatCost(row.estimated_cost_usd)}
                      </strong>
                    </div>
                  </td>
                  <td>
                    <button
                      className={styles.monitoringActionButton}
                      type="button"
                      aria-label="查看请求详情"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedEvent(row);
                      }}
                    >
                      <IconFileText size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {monitoringRows.length === 0 ? (
          <div className={styles.tableEmpty}>{t('usage_analytics.no_data')}</div>
        ) : null}
      </div>
      <div className={styles.monitoringPagination}>
        <span>
          共 {formatNumber(monitoringFilteredEvents.length)} 条
          {data?.events?.has_more ? `，已加载 ${formatNumber(events.length)} 条` : ''}
        </span>
        <div className={styles.monitoringPaginationActions}>
          {data?.events?.has_more ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleLoadMoreEvents()}
              loading={eventsLoadingMore}
            >
              {t('usage_analytics.load_more')}
            </Button>
          ) : null}
          <Select
            className={styles.monitoringPageSize}
            value={monitoringPageSize}
            onChange={setMonitoringPageSize}
            options={monitoringPageSizeOptions}
            ariaLabel="每页条数"
            size="sm"
          />
          <button
            className={styles.monitoringPageButton}
            type="button"
            aria-label="上一页"
            disabled={safeMonitoringPage <= 1}
            onClick={() => setMonitoringPage((page) => Math.max(1, page - 1))}
          >
            <IconChevronLeft size={15} />
          </button>
          {monitoringPageNumbers.map((page, index) => {
            const previous = monitoringPageNumbers[index - 1];
            return (
              <span className={styles.monitoringPageGroup} key={page}>
                {previous && page - previous > 1 ? <i>...</i> : null}
                <button
                  className={`${styles.monitoringPageButton} ${
                    page === safeMonitoringPage ? styles.monitoringPageButtonActive : ''
                  }`}
                  type="button"
                  onClick={() => setMonitoringPage(page)}
                >
                  {page}
                </button>
              </span>
            );
          })}
          <button
            className={styles.monitoringPageButton}
            type="button"
            aria-label="下一页"
            disabled={safeMonitoringPage >= monitoringPageCount && !data?.events?.has_more}
            onClick={() => void handleMonitoringNextPage()}
          >
            <IconChevronLeft className={styles.monitoringNextIcon} size={15} />
          </button>
        </div>
      </div>
    </Card>
  );

  const renderMonitoring = () => (
    <>
      {renderMonitoringKpiCards()}
      {renderMonitoringFilters()}
      {renderMonitoringTable()}
    </>
  );

  const renderMonitoringDetailSheet = () => (
    <Sheet
      open={selectedEvent !== null}
      onClose={() => setSelectedEvent(null)}
      size="lg"
      eyebrow={selectedEvent ? <StatusBadge row={selectedEvent} /> : undefined}
      title={t('usage_analytics.request_detail')}
      description={selectedEvent?.request_id || selectedEvent?.model || undefined}
      footer={
        selectedEvent ? (
          <Button
            variant="secondary"
            onClick={() => void handleCopySelectedFailure()}
            disabled={!selectedEvent.fail_summary && !selectedEvent.fail_body}
          >
            <IconCopy size={16} />
            {t('usage_analytics.copy_error_detail')}
          </Button>
        ) : undefined
      }
    >
      {selectedEvent ? (
        <div className={styles.detailContent}>
          <div className={styles.detailGrid}>
            <DetailItem
              label={t('usage_analytics.time')}
              value={formatFullDateTime(selectedEvent.timestamp_ms)}
            />
            <DetailItem
              label={t('usage_analytics.request_id')}
              value={selectedEvent.request_id || '-'}
            />
            <DetailItem
              label={t('usage_analytics.status_code')}
              value={<StatusBadge row={selectedEvent} />}
            />
            <DetailItem
              label={t('usage_analytics.latency')}
              value={formatDuration(selectedEvent.latency_ms)}
            />
            <DetailItem
              label={t('usage_analytics.ttft')}
              value={formatDuration(selectedEvent.ttft_ms)}
            />
            <DetailItem
              label={t('usage_analytics.output_speed')}
              value={formatTokensPerSecond(selectedEvent)}
            />
            <DetailItem
              label={t('usage_analytics.provider')}
              value={providerLabel(selectedEvent.provider)}
            />
            <DetailItem label={t('usage_analytics.model')} value={selectedEvent.model || '-'} />
            <DetailItem
              label={t('usage_analytics.endpoint')}
              value={selectedEvent.endpoint || '-'}
            />
            <DetailItem
              label={t('usage_analytics.credential')}
              value={credentialText(selectedEvent) || '-'}
            />
            <DetailItem
              label={t(selectedEventAPIKeyDisplay?.labelKey ?? 'usage_analytics.api_key_hash')}
              value={selectedEventAPIKeyDisplay?.value ?? '-'}
            />
            <DetailItem
              label={t('usage_analytics.auth_type')}
              value={selectedEvent.auth_type || '-'}
            />
            <DetailItem
              label={t('usage_analytics.service_tier')}
              value={selectedEvent.service_tier || '-'}
            />
            <DetailItem
              label={t('usage_analytics.cost')}
              value={
                selectedEvent.missing_price_model_name
                  ? t('usage_analytics.price_missing')
                  : formatCost(selectedEvent.estimated_cost_usd)
              }
            />
          </div>
          <section className={styles.detailSection}>
            <h3>
              <IconFileText size={16} />
              {t('usage_analytics.token_breakdown')}
            </h3>
            <div className={styles.tokenDetailGrid}>
              <DetailItem
                label={t('usage_analytics.tokens')}
                value={formatNumber(selectedEvent.tokens?.total_tokens)}
              />
              <DetailItem
                label={t('usage_analytics.input_tokens')}
                value={formatNumber(selectedEvent.tokens?.input_tokens)}
              />
              <DetailItem
                label={t('usage_analytics.output_tokens')}
                value={formatNumber(selectedEvent.tokens?.output_tokens)}
              />
              <DetailItem
                label={t('usage_analytics.reasoning_tokens')}
                value={formatNumber(selectedEvent.tokens?.reasoning_tokens)}
              />
              <DetailItem
                label={t('usage_analytics.cache_read_tokens')}
                value={formatNumber(selectedEvent.tokens?.cache_read_tokens)}
              />
              <DetailItem
                label={t('usage_analytics.cache_creation_tokens')}
                value={formatNumber(selectedEvent.tokens?.cache_creation_tokens)}
              />
            </div>
          </section>
          <section className={styles.failureSection}>
            <h3>
              <IconTimer size={16} />
              {t('usage_analytics.error_summary')}
            </h3>
            {(() => {
              const error = resolveUsageAnalyticsErrorDisplay(
                selectedEvent,
                t('usage_analytics.no_error_summary')
              );
              return (
                <>
                  <p>{error.summary}</p>
                  {error.detail ? <pre>{error.detail}</pre> : null}
                  {selectedEvent.fail_body ? <pre>{selectedEvent.fail_body}</pre> : null}
                </>
              );
            })()}
          </section>
        </div>
      ) : null}
    </Sheet>
  );

  return (
    <div className={styles.container}>
      {isCompleteAnalysisView ? (
        <div className={styles.completeHeader}>
          <div className={styles.completeHeaderMain}>
            <div className={styles.breadcrumb}>
              用量分析 <span>/</span> <strong>完整分析</strong>
            </div>
            <Button
              className={styles.completeBackButton}
              variant="secondary"
              onClick={() => switchAnalysisMode('overview')}
            >
              <IconChevronLeft size={15} />
              返回用量分析
            </Button>
          </div>
          <div className={styles.headerActions}>
            <Button variant="secondary" onClick={() => void handleExport()} loading={exportLoading}>
              <IconDownload size={16} />
              导出报告
            </Button>
            <Button onClick={() => void load()} loading={loading}>
              <IconRefreshCw size={16} />
              刷新数据
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>
              {t(isMonitoringView ? 'request_monitoring.title' : 'usage_analytics.title')}
            </h1>
            <p className={styles.pageSubtitle}>
              {t(isMonitoringView ? 'request_monitoring.subtitle' : 'usage_analytics.subtitle')}
            </p>
          </div>
          <div className={styles.headerActions}>
            <Button variant="secondary" onClick={() => void handleExport()} loading={exportLoading}>
              <IconDownload size={16} />
              {t('usage_analytics.export')}
            </Button>
            <Button onClick={() => void load()} loading={loading}>
              <IconRefreshCw size={16} />
              {isMonitoringView ? '刷新数据' : t('common.refresh')}
            </Button>
          </div>
        </div>
      )}

      {!isMonitoringView ? renderFilters() : null}

      {error ? <EmptyState title={t('usage_analytics.load_failed')} description={error} /> : null}

      {isMonitoringView
        ? renderMonitoring()
        : analysisMode === 'complete'
          ? renderCompleteAnalysis()
          : renderOverviewAnalytics()}

      {isMonitoringView ? renderMonitoringDetailSheet() : null}
    </div>
  );
}
