import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { IconRefreshCw } from '@/components/ui/icons';
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
import { getErrorMessage } from '@/utils/helpers';
import styles from './UsageAnalyticsPage.module.scss';

type RangeKey = '24h' | '7d' | '30d';

const RANGE_MS: Record<RangeKey, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

const EVENT_LIMIT = 80;

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

const successRate = (success: number, total: number) =>
  total > 0 ? `${Math.round((success / total) * 100)}%` : '-';

const compactHash = (value: string | undefined | null, length = 12) => {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  return trimmed.length <= length ? trimmed : `${trimmed.slice(0, length)}...`;
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
  label: string;
  meta?: string;
}

function IdentityPill({ tone, label, meta }: IdentityPillProps) {
  return (
    <div className={styles.identityPill}>
      <span className={styles.identityBadge}>{providerLabel(tone)}</span>
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
}: {
  rows: T[];
  columns: Array<{ key: string; label: string; render: (row: T) => ReactNode }>;
  empty: string;
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
            <tr key={index}>
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
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const to = Date.now();
    const from = to - RANGE_MS[range];
    setLoading(true);
    setError('');
    try {
      const response = await usageAnalyticsApi.query({
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
          events_page: { limit: EVENT_LIMIT },
        },
      });
      setData(response);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [apiKeyHashFilter, authIndexFilter, failedOnly, modelFilter, providerFilter, range]);

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
    (row: UsageAnalyticsAPIKeyStat) => (
      <IdentityPill
        tone={row.provider}
        label={providerLabel(row.provider)}
        meta={row.api_key_hash ? `hash ${compactHash(row.api_key_hash)}` : undefined}
      />
    ),
    []
  );

  const renderCredentialIdentity = useCallback(
    (row: UsageAnalyticsCredentialStat | UsageAnalyticsEventRow) => {
      const provider = row.provider;
      const accountID = accountIdFromRef(row.account_ref);
      const opencodeAccount = provider === 'opencode-go' && accountID ? opencodeByID.get(accountID) : undefined;
      const authFile = row.auth_index ? authFileByIndex.get(row.auth_index) : undefined;
      const label =
        (opencodeAccount ? displayOpenCodeGoAccountName(opencodeAccount) : '') ||
        (authFile ? authFileDisplayName(authFile) : '') ||
        row.auth_file_name ||
        row.auth_index ||
        accountID ||
        '-';
      const metaParts = [
        row.auth_file_name && row.auth_file_name !== label ? row.auth_file_name : '',
        row.auth_index ? `idx ${compactHash(row.auth_index, 10)}` : '',
        accountID && accountID !== label ? accountID : '',
      ].filter(Boolean);

      return <IdentityPill tone={provider} label={label} meta={metaParts.join(' · ')} />;
    },
    [authFileByIndex, opencodeByID]
  );

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
      { key: 'provider', label: t('usage_analytics.provider'), render: (row: UsageAnalyticsEventRow) => row.provider || '-' },
      { key: 'model', label: t('usage_analytics.model'), render: (row: UsageAnalyticsEventRow) => row.model || '-' },
      { key: 'credential', label: t('usage_analytics.credential'), render: renderCredentialIdentity },
      { key: 'tokens', label: t('usage_analytics.tokens'), render: (row: UsageAnalyticsEventRow) => formatNumber(row.tokens?.total_tokens) },
      { key: 'status', label: t('usage_analytics.status'), render: (row: UsageAnalyticsEventRow) => row.failed ? t('usage_analytics.failed') : t('usage_analytics.success') },
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
        <Button onClick={() => void load()} loading={loading}>
          <IconRefreshCw size={16} />
          {t('common.refresh')}
        </Button>
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
        <StatTable rows={data?.events?.items ?? []} columns={eventColumns} empty={t('usage_analytics.no_data')} />
      </Card>
    </div>
  );
}
