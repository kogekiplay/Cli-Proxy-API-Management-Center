import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { IconDownload, IconRefreshCw } from '@/components/ui/icons';
import { authFilesApi } from '@/services/api';
import { opencodeGoApi } from '@/services/api/opencodeGo';
import {
  usageAnalyticsApi,
  type UsageAnalyticsAPIKeyStat,
  type UsageAnalyticsCredentialStat,
  type UsageAnalyticsEventRow,
  type UsageAnalyticsModelStat,
  type UsageAnalyticsResponse,
} from '@/services/api/usageAnalytics';
import type { AuthFileItem } from '@/types';
import type { OpenCodeGoAccount } from '@/types/opencodeGo';
import { displayOpenCodeGoAccountName } from '@/features/opencodeGo/helpers';
import { downloadBlob } from '@/utils/download';
import { getErrorMessage } from '@/utils/helpers';
import styles from './UsageAnalyticsPage.module.scss';

type RangeKey = '24h' | '7d' | '30d';

const RANGE_MS: Record<RangeKey, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

const EVENT_LIMIT = 80;
const EXPORT_EVENT_LIMIT = 50000;

const splitFilter = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const formatNumber = (value: number | undefined | null) =>
  new Intl.NumberFormat().format(value ?? 0);

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

const formatDuration = (value: number | undefined | null) => {
  if (value === undefined || value === null || !Number.isFinite(value) || value <= 0) return '-';
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(value < 10_000 ? 2 : 1)} s`;
};

const successRate = (success: number, total: number) =>
  total > 0 ? `${Math.round((success / total) * 100)}%` : '-';

const compactHash = (value: string | undefined | null, length = 12) => {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  return trimmed.length <= length ? trimmed : `${trimmed.slice(0, length)}...`;
};

const statusCodeOf = (row: UsageAnalyticsEventRow) =>
  row.status_code || row.fail_status_code || (row.failed ? 500 : 200);

const csvEscape = (value: unknown) => {
  const text = value === undefined || value === null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const providerLabel = (value: string | undefined | null) => {
  const provider = value?.trim() ?? '';
  if (!provider) return 'Unknown';
  if (provider === 'opencode-go') return 'OpenCode';
  return provider.charAt(0).toUpperCase() + provider.slice(1);
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

interface IdentityPillProps {
  tone?: string;
  badge?: string;
  label: string;
  meta?: string;
}

function IdentityPill({ tone, badge, label, meta }: IdentityPillProps) {
  return (
    <div className={styles.identityPill}>
      <span className={styles.identityBadge}>{badge ?? providerLabel(tone)}</span>
      <span className={styles.identityText}>
        <strong>{label}</strong>
        {meta ? <small>{meta}</small> : null}
      </span>
    </div>
  );
}

function StatTable<T>({
  rows,
  columns,
  empty,
  getRowKey,
  onRowClick,
}: {
  rows: T[];
  columns: Array<{ key: string; label: string; render: (row: T) => ReactNode }>;
  empty: string;
  getRowKey?: (row: T, index: number) => string | number;
  onRowClick?: (row: T) => void;
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
              className={onRowClick ? styles.clickableRow : undefined}
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

export function UsageAnalyticsPage() {
  const { t } = useTranslation();
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
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<UsageAnalyticsEventRow | null>(null);

  const buildAnalyticsRequest = useCallback((limit: number) => {
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
        summary: true,
        timeline: true,
        model_stats: true,
        api_key_stats: true,
        credential_stats: true,
        events_page: { limit },
      },
    };
  }, [apiKeyHashFilter, authIndexFilter, failedOnly, modelFilter, providerFilter, range]);

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
  const timelineMax = useMemo(
    () => Math.max(...(data?.timeline ?? []).map((item) => item.total_tokens), 1),
    [data?.timeline]
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

      return <IdentityPill badge="API Key" label={label} />;
    },
    [opencodeByID]
  );

  const renderCredentialIdentity = useCallback(
    (row: UsageAnalyticsCredentialStat | UsageAnalyticsEventRow) => {
      const provider = row.provider;
      const accountID = accountIdFromRef(row.account_ref);
      const opencodeAccount = provider === 'opencode-go' && accountID ? opencodeByID.get(accountID) : undefined;
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

      return <IdentityPill tone={provider} label={label} meta={metaParts.join(' · ')} />;
    },
    [authFileByIndex, opencodeByID, t]
  );

  const credentialText = useCallback(
    (row: UsageAnalyticsCredentialStat | UsageAnalyticsEventRow) => {
      const provider = row.provider;
      const accountID = accountIdFromRef(row.account_ref);
      const opencodeAccount = provider === 'opencode-go' && accountID ? opencodeByID.get(accountID) : undefined;
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
        ].map(csvEscape).join(',')
      );
      return [headers.join(','), ...lines].join('\n');
    },
    [credentialText]
  );

  const handleExport = useCallback(async () => {
    setExportLoading(true);
    setError('');
    try {
      const response = await usageAnalyticsApi.query(buildAnalyticsRequest(EXPORT_EVENT_LIMIT));
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

  const modelColumns = useMemo(
    () => [
      { key: 'model', label: t('usage_analytics.model'), render: (row: UsageAnalyticsModelStat) => row.model || '-' },
      { key: 'calls', label: t('usage_analytics.calls'), render: (row: UsageAnalyticsModelStat) => formatNumber(row.calls) },
      { key: 'tokens', label: t('usage_analytics.tokens'), render: (row: UsageAnalyticsModelStat) => formatNumber(row.total_tokens) },
      { key: 'rate', label: t('usage_analytics.success_rate'), render: (row: UsageAnalyticsModelStat) => successRate(row.success_calls, row.calls) },
      { key: 'cost', label: t('usage_analytics.cost'), render: (row: UsageAnalyticsModelStat) => formatCost(row.cost) },
    ],
    [t]
  );

  const apiKeyColumns = useMemo(
    () => [
      { key: 'apiKey', label: t('usage_analytics.api_key'), render: renderAPIKeyIdentity },
      { key: 'calls', label: t('usage_analytics.calls'), render: (row: UsageAnalyticsAPIKeyStat) => formatNumber(row.calls) },
      { key: 'tokens', label: t('usage_analytics.tokens'), render: (row: UsageAnalyticsAPIKeyStat) => formatNumber(row.total_tokens) },
      { key: 'rate', label: t('usage_analytics.success_rate'), render: (row: UsageAnalyticsAPIKeyStat) => successRate(row.success_calls, row.calls) },
      { key: 'cost', label: t('usage_analytics.cost'), render: (row: UsageAnalyticsAPIKeyStat) => formatCost(row.cost) },
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
      { key: 'calls', label: t('usage_analytics.calls'), render: (row: UsageAnalyticsCredentialStat) => formatNumber(row.calls) },
      { key: 'tokens', label: t('usage_analytics.tokens'), render: (row: UsageAnalyticsCredentialStat) => formatNumber(row.total_tokens) },
      { key: 'rate', label: t('usage_analytics.success_rate'), render: (row: UsageAnalyticsCredentialStat) => successRate(row.success_calls, row.calls) },
      { key: 'cost', label: t('usage_analytics.cost'), render: (row: UsageAnalyticsCredentialStat) => formatCost(row.cost) },
    ],
    [renderCredentialIdentity, t]
  );

  const eventColumns = useMemo(
    () => [
      { key: 'time', label: t('usage_analytics.time'), render: (row: UsageAnalyticsEventRow) => formatDateTime(row.timestamp_ms) },
      {
        key: 'statusCode',
        label: t('usage_analytics.status_code'),
        render: (row: UsageAnalyticsEventRow) => (
          <span className={`${styles.statusBadge} ${row.failed ? styles.statusFailed : styles.statusSuccess}`}>
            {statusCodeOf(row)}
          </span>
        ),
      },
      { key: 'provider', label: t('usage_analytics.provider'), render: (row: UsageAnalyticsEventRow) => providerLabel(row.provider) },
      { key: 'model', label: t('usage_analytics.model'), render: (row: UsageAnalyticsEventRow) => row.model || '-' },
      { key: 'credential', label: t('usage_analytics.credential'), render: renderCredentialIdentity },
      { key: 'latency', label: t('usage_analytics.latency'), render: (row: UsageAnalyticsEventRow) => formatDuration(row.latency_ms) },
      { key: 'ttft', label: t('usage_analytics.ttft'), render: (row: UsageAnalyticsEventRow) => formatDuration(row.ttft_ms) },
      { key: 'tokens', label: t('usage_analytics.tokens'), render: (row: UsageAnalyticsEventRow) => formatNumber(row.tokens?.total_tokens) },
      {
        key: 'error',
        label: t('usage_analytics.error_summary'),
        render: (row: UsageAnalyticsEventRow) => row.fail_summary || '-',
      },
    ],
    [renderCredentialIdentity, t]
  );

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
          <Input value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)} placeholder={t('usage_analytics.provider_filter')} />
          <Input value={modelFilter} onChange={(event) => setModelFilter(event.target.value)} placeholder={t('usage_analytics.model_filter')} />
          <Input value={authIndexFilter} onChange={(event) => setAuthIndexFilter(event.target.value)} placeholder={t('usage_analytics.auth_filter')} />
          <Input value={apiKeyHashFilter} onChange={(event) => setAPIKeyHashFilter(event.target.value)} placeholder={t('usage_analytics.api_key_filter')} />
          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={failedOnly} onChange={(event) => setFailedOnly(event.target.checked)} />
            <span>{t('usage_analytics.failed_only')}</span>
          </label>
        </div>
      </Card>

      {error ? (
        <EmptyState title={t('usage_analytics.load_failed')} description={error} />
      ) : null}

      <div className={styles.summaryGrid}>
        <Card className={styles.metricCard}>
          <span>{t('usage_analytics.calls')}</span>
          <strong>{formatNumber(summary?.total_calls)}</strong>
        </Card>
        <Card className={styles.metricCard}>
          <span>{t('usage_analytics.tokens')}</span>
          <strong>{formatNumber(summary?.total_tokens)}</strong>
        </Card>
        <Card className={styles.metricCard}>
          <span>{t('usage_analytics.cost')}</span>
          <strong>{formatCost(summary?.total_cost)}</strong>
        </Card>
        <Card className={styles.metricCard}>
          <span>{t('usage_analytics.success_rate')}</span>
          <strong>{successRate(summary?.success_calls ?? 0, summary?.total_calls ?? 0)}</strong>
        </Card>
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
          <StatTable rows={data?.model_stats ?? []} columns={modelColumns} empty={t('usage_analytics.no_data')} />
        </Card>
        <Card title={t('usage_analytics.api_key_stats')}>
          <StatTable rows={data?.api_key_stats ?? []} columns={apiKeyColumns} empty={t('usage_analytics.no_data')} />
        </Card>
      </div>

      <Card title={t('usage_analytics.credential_stats')}>
        <StatTable rows={data?.credential_stats ?? []} columns={credentialColumns} empty={t('usage_analytics.no_data')} />
      </Card>

      <Card title={t('usage_analytics.recent_requests')}>
        <StatTable
          rows={data?.events?.items ?? []}
          columns={eventColumns}
          empty={t('usage_analytics.no_data')}
          getRowKey={(row) => row.id || row.request_id}
          onRowClick={setSelectedEvent}
        />
      </Card>

      <Sheet
        open={selectedEvent !== null}
        onClose={() => setSelectedEvent(null)}
        size="lg"
        title={t('usage_analytics.request_detail')}
        description={selectedEvent?.request_id || selectedEvent?.model || undefined}
      >
        {selectedEvent ? (
          <div className={styles.detailContent}>
            <div className={styles.detailGrid}>
              <DetailItem label={t('usage_analytics.time')} value={formatDateTime(selectedEvent.timestamp_ms)} />
              <DetailItem label={t('usage_analytics.status_code')} value={statusCodeOf(selectedEvent)} />
              <DetailItem label={t('usage_analytics.latency')} value={formatDuration(selectedEvent.latency_ms)} />
              <DetailItem label={t('usage_analytics.ttft')} value={formatDuration(selectedEvent.ttft_ms)} />
              <DetailItem label={t('usage_analytics.provider')} value={providerLabel(selectedEvent.provider)} />
              <DetailItem label={t('usage_analytics.model')} value={selectedEvent.model || '-'} />
              <DetailItem label={t('usage_analytics.endpoint')} value={selectedEvent.endpoint || '-'} />
              <DetailItem label={t('usage_analytics.credential')} value={credentialText(selectedEvent) || '-'} />
              <DetailItem label={t('usage_analytics.api_key_hash')} value={selectedEvent.api_key_hash || selectedEvent.credential_key_hash || '-'} />
              <DetailItem label={t('usage_analytics.auth_type')} value={selectedEvent.auth_type || '-'} />
              <DetailItem label={t('usage_analytics.service_tier')} value={selectedEvent.service_tier || '-'} />
              <DetailItem label={t('usage_analytics.cost')} value={formatCost(selectedEvent.estimated_cost_usd)} />
            </div>
            <div className={styles.tokenDetailGrid}>
              <DetailItem label={t('usage_analytics.tokens')} value={formatNumber(selectedEvent.tokens?.total_tokens)} />
              <DetailItem label={t('usage_analytics.input_tokens')} value={formatNumber(selectedEvent.tokens?.input_tokens)} />
              <DetailItem label={t('usage_analytics.output_tokens')} value={formatNumber(selectedEvent.tokens?.output_tokens)} />
              <DetailItem label={t('usage_analytics.reasoning_tokens')} value={formatNumber(selectedEvent.tokens?.reasoning_tokens)} />
              <DetailItem label={t('usage_analytics.cache_read_tokens')} value={formatNumber(selectedEvent.tokens?.cache_read_tokens)} />
              <DetailItem label={t('usage_analytics.cache_creation_tokens')} value={formatNumber(selectedEvent.tokens?.cache_creation_tokens)} />
            </div>
            <section className={styles.failureSection}>
              <h3>{t('usage_analytics.error_summary')}</h3>
              <p>{selectedEvent.fail_summary || t('usage_analytics.no_error_summary')}</p>
              {selectedEvent.fail_body ? <pre>{selectedEvent.fail_body}</pre> : null}
            </section>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
