import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import {
  IconAlertTriangle,
  IconCheckCircle2,
  IconCopy,
  IconDollarSign,
  IconDownload,
  IconFileText,
  IconInbox,
  IconKey,
  IconRefreshCw,
  IconTimer,
} from '@/components/ui/icons';
import { displayOpenCodeGoAccountName } from '@/features/opencodeGo/helpers';
import { authFilesApi } from '@/services/api';
import { opencodeGoApi } from '@/services/api/opencodeGo';
import {
  usageAnalyticsApi,
  type UsageAnalyticsAPIKeyStat,
  type UsageAnalyticsCredentialStat,
  type UsageAnalyticsEventRow,
  type UsageAnalyticsModelStat,
  type UsageAnalyticsRequest,
  type UsageAnalyticsResponse,
} from '@/services/api/usageAnalytics';
import { useNotificationStore } from '@/stores';
import type { AuthFileItem } from '@/types';
import type { OpenCodeGoAccount } from '@/types/opencodeGo';
import { copyToClipboard } from '@/utils/clipboard';
import { downloadBlob } from '@/utils/download';
import { getErrorMessage } from '@/utils/helpers';
import styles from './UsageAnalyticsPage.module.scss';

type RangeKey = '24h' | '7d' | '30d';
type SummaryAccent = 'blue' | 'green' | 'red' | 'amber' | 'teal' | 'cyan';

const RANGE_MS: Record<RangeKey, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

const EVENT_LIMIT = 80;
const EXPORT_EVENT_LIMIT = 50000;
const EMPTY_EVENTS: UsageAnalyticsEventRow[] = [];

const splitFilter = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

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

const formatDateTime = (value: number | undefined | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
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

const buildFailureCopyText = (row: UsageAnalyticsEventRow) =>
  [
    `request_id: ${row.request_id || '-'}`,
    `status_code: ${statusCodeOf(row)}`,
    row.fail_summary ? `summary: ${row.fail_summary}` : '',
    row.fail_body ? `body:\n${row.fail_body}` : '',
  ]
    .filter(Boolean)
    .join('\n');

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
  const summary = row.fail_summary?.trim() ?? '';
  if (!row.failed && !summary) return <span className={styles.mutedDash}>-</span>;

  const body = row.fail_body?.trim() ?? '';
  return (
    <span className={styles.errorHint} tabIndex={0}>
      <span>{summary || emptyLabel}</span>
      {(summary || body) && (
        <span className={styles.errorTooltip} role="tooltip">
          {summary ? <strong>{summary}</strong> : null}
          {body ? <small>{body}</small> : null}
        </span>
      )}
    </span>
  );
}

export function UsageAnalyticsPage() {
  const { t } = useTranslation();
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
  const [loading, setLoading] = useState(false);
  const [eventsLoadingMore, setEventsLoadingMore] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<UsageAnalyticsEventRow | null>(null);

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
          providers: splitFilter(providerFilter),
          models: splitFilter(modelFilter),
          auth_indices: splitFilter(authIndexFilter),
          api_key_hashes: splitFilter(apiKeyHashFilter),
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

  const summary = data?.summary;
  const events = data?.events?.items ?? EMPTY_EVENTS;
  const timelineMax = useMemo(
    () => Math.max(...(data?.timeline ?? []).map((item) => item.total_tokens), 1),
    [data?.timeline]
  );

  const eventMetrics = useMemo(
    () => ({
      averageLatencyMs: average(events.map((row) => row.latency_ms)),
      p95LatencyMs: percentile(events.map((row) => row.latency_ms), 0.95),
      p95TtftMs: percentile(events.map((row) => row.ttft_ms), 0.95),
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

      return (
        <IdentityPill
          provider={provider}
          label={label}
          meta={metaParts.join(' · ')}
        />
      );
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

  const handleCopySelectedFailure = useCallback(async () => {
    if (!selectedEvent) return;
    const copied = await copyToClipboard(buildFailureCopyText(selectedEvent));
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

  const eventColumns = useMemo(
    () => [
      {
        key: 'time',
        label: t('usage_analytics.time'),
        render: (row: UsageAnalyticsEventRow) => (
          <span className={styles.eventTime}>{formatDateTime(row.timestamp_ms)}</span>
        ),
      },
      {
        key: 'request',
        label: t('usage_analytics.request'),
        render: (row: UsageAnalyticsEventRow) => (
          <div className={styles.requestCell}>
            <strong>{row.model || '-'}</strong>
            <small>{[providerLabel(row.provider), row.endpoint].filter(Boolean).join(' · ')}</small>
          </div>
        ),
      },
      {
        key: 'credential',
        label: t('usage_analytics.credential'),
        render: renderCredentialIdentity,
      },
      {
        key: 'statusCode',
        label: t('usage_analytics.status_code'),
        render: (row: UsageAnalyticsEventRow) => (
          <div className={styles.statusCell}>
            <StatusBadge row={row} />
            <ErrorSummary row={row} emptyLabel={t('usage_analytics.no_error_summary')} />
          </div>
        ),
      },
      {
        key: 'latency',
        label: t('usage_analytics.latency_ttft'),
        render: (row: UsageAnalyticsEventRow) => (
          <div className={styles.latencyCell}>
            <span>
              <strong>{formatDuration(row.latency_ms)}</strong>
              <small>{t('usage_analytics.latency')}</small>
            </span>
            <i aria-hidden="true" />
            <span>
              <strong>{formatDuration(row.ttft_ms)}</strong>
              <small>{t('usage_analytics.ttft')}</small>
            </span>
          </div>
        ),
      },
      {
        key: 'usage',
        label: t('usage_analytics.usage'),
        render: (row: UsageAnalyticsEventRow) => (
          <div className={styles.usageCell}>
            <strong>{formatNumber(row.tokens?.total_tokens)}</strong>
            <small>{tokenSummary(row)}</small>
            <small>{`${t('usage_analytics.output_speed')} ${formatTokensPerSecond(row)}`}</small>
          </div>
        ),
      },
      {
        key: 'cost',
        label: t('usage_analytics.cost'),
        render: (row: UsageAnalyticsEventRow) => (
          <span className={row.missing_price_model_name ? styles.warnText : undefined}>
            {row.missing_price_model_name ? t('usage_analytics.price_missing') : formatCost(row.estimated_cost_usd)}
          </span>
        ),
      },
    ],
    [renderCredentialIdentity, t]
  );

  const failureCalls = summary?.failure_calls ?? 0;
  const totalCalls = summary?.total_calls ?? 0;
  const successCalls = summary?.success_calls ?? 0;
  const totalTokens = summary?.total_tokens ?? 0;

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{t('usage_analytics.title')}</h1>
          <p className={styles.pageSubtitle}>{t('usage_analytics.subtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="secondary" onClick={() => void handleExport()} loading={exportLoading}>
            <IconDownload size={16} />
            {t('usage_analytics.export')}
          </Button>
          <Button onClick={() => void load()} loading={loading}>
            <IconRefreshCw size={16} />
            {t('common.refresh')}
          </Button>
        </div>
      </div>

      <Card className={styles.filterCard}>
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
          <Input
            value={providerFilter}
            onChange={(event) => setProviderFilter(event.target.value)}
            placeholder={t('usage_analytics.provider_filter')}
          />
          <Input
            value={modelFilter}
            onChange={(event) => setModelFilter(event.target.value)}
            placeholder={t('usage_analytics.model_filter')}
          />
          <Input
            value={authIndexFilter}
            onChange={(event) => setAuthIndexFilter(event.target.value)}
            placeholder={t('usage_analytics.auth_filter')}
          />
          <Input
            value={apiKeyHashFilter}
            onChange={(event) => setAPIKeyHashFilter(event.target.value)}
            placeholder={t('usage_analytics.api_key_filter')}
          />
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={failedOnly}
              onChange={(event) => setFailedOnly(event.target.checked)}
            />
            <span>{t('usage_analytics.failed_only')}</span>
          </label>
        </div>
      </Card>

      {error ? (
        <EmptyState title={t('usage_analytics.load_failed')} description={error} />
      ) : null}

      <div className={styles.summaryGrid}>
        <SummaryCard
          accent="blue"
          icon={<IconInbox size={18} />}
          label={t('usage_analytics.calls')}
          value={formatNumber(totalCalls)}
          meta={t('usage_analytics.summary_success_failed', {
            success: formatNumber(successCalls),
            failed: formatNumber(failureCalls),
          })}
        />
        <SummaryCard
          accent="green"
          icon={<IconCheckCircle2 size={18} />}
          label={t('usage_analytics.success_rate')}
          value={successRate(successCalls, totalCalls)}
          meta={t('usage_analytics.summary_p95_latency', {
            value: formatDuration(eventMetrics.p95LatencyMs),
          })}
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
        <SummaryCard
          accent="cyan"
          icon={<IconKey size={18} />}
          label={t('usage_analytics.loaded_events')}
          value={formatNumber(events.length)}
          meta={t('usage_analytics.total_events_meta', {
            total: formatNumber(data?.events?.total_count ?? events.length),
          })}
        />
      </div>

      <Card title={t('usage_analytics.timeline')}>
        {(data?.timeline ?? []).length === 0 ? (
          <div className={styles.tableEmpty}>{t('usage_analytics.no_data')}</div>
        ) : (
          <div className={styles.timelineList}>
            {(data?.timeline ?? []).map((point) => (
              <div className={styles.timelineRow} key={point.bucket_ms}>
                <span>{formatDateTime(point.bucket_ms)}</span>
                <div className={styles.timelineBarTrack}>
                  <div
                    className={styles.timelineBar}
                    style={{ width: `${Math.max(4, (point.total_tokens / timelineMax) * 100)}%` }}
                  />
                </div>
                <strong>{formatNumber(point.total_tokens)}</strong>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className={styles.gridTwo}>
        <Card title={t('usage_analytics.model_stats')}>
          <StatTable
            rows={data?.model_stats ?? []}
            columns={modelColumns}
            empty={t('usage_analytics.no_data')}
          />
        </Card>
        <Card title={t('usage_analytics.api_key_stats')}>
          <StatTable
            rows={data?.api_key_stats ?? []}
            columns={apiKeyColumns}
            empty={t('usage_analytics.no_data')}
          />
        </Card>
      </div>

      <Card title={t('usage_analytics.credential_stats')}>
        <StatTable
          rows={data?.credential_stats ?? []}
          columns={credentialColumns}
          empty={t('usage_analytics.no_data')}
        />
      </Card>

      <Card
        title={t('usage_analytics.recent_requests')}
        extra={
          <span className={styles.cardMeta}>
            {t('usage_analytics.events_loaded_meta', {
              loaded: formatNumber(events.length),
              total: formatNumber(data?.events?.total_count ?? events.length),
            })}
          </span>
        }
      >
        <StatTable
          rows={events}
          columns={eventColumns}
          empty={t('usage_analytics.no_data')}
          getRowKey={(row) => eventRowKey(row)}
          onRowClick={setSelectedEvent}
          rowClassName={(row) => (row.failed ? styles.eventRowFailed : undefined)}
        />
        {data?.events?.has_more ? (
          <div className={styles.loadMoreBar}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleLoadMoreEvents()}
              loading={eventsLoadingMore}
            >
              {t('usage_analytics.load_more')}
            </Button>
          </div>
        ) : events.length > 0 ? (
          <div className={styles.loadMoreBar}>
            <span>{t('usage_analytics.no_more_events')}</span>
          </div>
        ) : null}
      </Card>

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
                label={t('usage_analytics.api_key_hash')}
                value={selectedEvent.api_key_hash || selectedEvent.credential_key_hash || '-'}
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
              <p>{selectedEvent.fail_summary || t('usage_analytics.no_error_summary')}</p>
              {selectedEvent.fail_body ? <pre>{selectedEvent.fail_body}</pre> : null}
            </section>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
