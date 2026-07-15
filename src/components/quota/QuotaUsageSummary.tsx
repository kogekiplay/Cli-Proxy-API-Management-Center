import { useTranslation } from 'react-i18next';
import type { UsageSummary } from '@/types/usage';
import styles from '@/pages/QuotaPage.module.scss';

interface QuotaUsageSummaryProps {
  summary?: UsageSummary;
}

const formatUsageTokens = (value: number): string =>
  new Intl.NumberFormat(undefined, {
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 10_000 ? 1 : 0,
  }).format(value);

const formatUsageCost = (value: number): string =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: value >= 1 ? 2 : 4,
    maximumFractionDigits: value >= 1 ? 2 : 4,
  }).format(value);

export function QuotaUsageSummary({ summary }: QuotaUsageSummaryProps) {
  const { t } = useTranslation();
  if (!summary) return null;

  const tokens = summary.tokens;
  const totalTokens = tokens?.total_tokens ?? 0;
  if (totalTokens <= 0 && summary.request_count <= 0) return null;

  const estimatedCost =
    summary.estimated_cost_usd === null || summary.estimated_cost_usd === undefined
      ? t('quota_usage.unpriced')
      : formatUsageCost(summary.estimated_cost_usd);

  const items = [
    {
      key: 'requests',
      label: t('quota_usage.requests'),
      value: formatUsageTokens(summary.request_count),
    },
    {
      key: 'total',
      label: t('quota_usage.total_tokens'),
      value: formatUsageTokens(totalTokens),
    },
    {
      key: 'input',
      label: t('quota_usage.input_tokens'),
      value: formatUsageTokens(tokens?.input_tokens ?? 0),
    },
    {
      key: 'output',
      label: t('quota_usage.output_tokens'),
      value: formatUsageTokens(tokens?.output_tokens ?? 0),
    },
    {
      key: 'cached',
      label: t('quota_usage.cached_tokens'),
      value: formatUsageTokens(tokens?.cached_tokens ?? 0),
    },
    {
      key: 'cache-read',
      label: t('quota_usage.cache_read_tokens'),
      value: formatUsageTokens(tokens?.cache_read_tokens ?? 0),
    },
    {
      key: 'cache-creation',
      label: t('quota_usage.cache_creation_tokens'),
      value: formatUsageTokens(tokens?.cache_creation_tokens ?? 0),
    },
    {
      key: 'cost',
      label: t('quota_usage.estimated_cost'),
      value: estimatedCost,
      emphasis: true,
    },
  ];

  return (
    <div className={styles.quotaUsageGrid} aria-label={t('quota_usage.summary_label')}>
      {items.map((item) => (
        <div className={styles.quotaUsageMetric} key={item.key}>
          <span className={styles.quotaUsageMetricLabel}>{item.label}</span>
          <strong className={item.emphasis ? styles.quotaUsageMetricEmphasis : undefined}>
            {item.value}
          </strong>
        </div>
      ))}
    </div>
  );
}
