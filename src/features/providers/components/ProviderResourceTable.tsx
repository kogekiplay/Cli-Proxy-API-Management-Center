import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IconAlertTriangle,
  IconCheckCircle2,
  IconEye,
  IconPencil,
  IconTrash2,
} from '@/components/ui/icons';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { ProviderStatusBar } from '@/components/providers/ProviderStatusBar';
import {
  getOpenAIProviderRecentStatusData,
  getOpenAIProviderTotalStats,
  getProviderRecentStatusData,
  getProviderTotalStats,
  type ProviderRecentUsageMap,
} from '@/components/providers/utils';
import type { OpenAIProviderConfig } from '@/types';
import type { StatusBarData } from '@/utils/recentRequests';
import type { ProviderResource } from '../types';
import styles from './ProviderResourceTable.module.scss';
import statusBarStyles from './providerStatusBar.module.scss';

interface ProviderResourceTableProps {
  resources: ProviderResource[];
  selectedId?: string | null;
  disableMutations?: boolean;
  usageByProvider?: ProviderRecentUsageMap;
  onView: (resource: ProviderResource) => void;
  onEdit: (resource: ProviderResource) => void;
  onDelete: (resource: ProviderResource) => void;
  onToggleDisabled?: (resource: ProviderResource, disabled: boolean) => void;
}

const columnWidths = ['220px', '220px', '138px', '120px', '140px'];

const resolveStatusBarData = (
  resource: ProviderResource,
  usageByProvider: ProviderRecentUsageMap
): StatusBarData => {
  if (resource.brand === 'openaiCompatibility') {
    return getOpenAIProviderRecentStatusData(resource.raw as OpenAIProviderConfig, usageByProvider);
  }
  return getProviderRecentStatusData(
    usageByProvider,
    resource.brand,
    resource.apiKey ?? undefined,
    resource.baseUrl ?? undefined
  );
};

const resolveTotalStats = (
  resource: ProviderResource,
  usageByProvider: ProviderRecentUsageMap
): { success: number; failure: number } => {
  if (resource.brand === 'openaiCompatibility') {
    return getOpenAIProviderTotalStats(resource.raw as OpenAIProviderConfig, usageByProvider);
  }
  return getProviderTotalStats(
    usageByProvider,
    resource.brand,
    resource.apiKey ?? undefined,
    resource.baseUrl ?? undefined
  );
};

export function ProviderResourceTable({
  resources,
  selectedId,
  disableMutations,
  usageByProvider,
  onView,
  onEdit,
  onDelete,
  onToggleDisabled,
}: ProviderResourceTableProps) {
  const { t } = useTranslation();

  const renderMetric = (key: string, label: string, value: number) => (
    <span key={key} className={styles.metric}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>{value}</span>
    </span>
  );

  const renderFlagTag = (key: string, label: string) => (
    <span key={key} className={styles.flagTag}>
      {label}
    </span>
  );

  const renderModelsSummary = (r: ProviderResource) => {
    const items: ReactNode[] = [];
    if (r.brand === 'openaiCompatibility') {
      items.push(
        renderMetric('models', t('providersPage.table.metrics.models'), r.modelCount),
        renderMetric('keys', t('providersPage.table.metrics.keys'), r.apiKeyEntryCount),
        renderMetric('headers', t('providersPage.table.metrics.headers'), r.headerCount)
      );
    } else {
      items.push(
        renderMetric('models', t('providersPage.table.metrics.models'), r.modelCount),
        renderMetric('headers', t('providersPage.table.metrics.headers'), r.headerCount)
      );
      if (r.brand === 'codex' && r.flags.websockets) {
        items.push(renderFlagTag('ws', t('providersPage.table.websocketsTag')));
      }
      if (r.brand === 'claude' && r.flags.cloakEnabled) {
        items.push(renderFlagTag('cloak', t('providersPage.table.cloakTag')));
      }
    }
    return <div className={styles.metricsCell}>{items}</div>;
  };

  const renderStatus = (r: ProviderResource) => {
    if (r.disabled) {
      return (
        <span className={`${styles.statusBadge} ${styles.statusDisabled}`}>
          <IconAlertTriangle size={14} />
          {t('providersPage.status.disabled')}
        </span>
      );
    }
    return (
      <span className={`${styles.statusBadge} ${styles.statusActive}`}>
        <IconCheckCircle2 size={14} />
        {t('providersPage.status.active')}
      </span>
    );
  };

  const renderPrimary = (r: ProviderResource) => {
    const prefixEl = r.prefix ? (
      <span className={styles.chip}>{r.prefix}</span>
    ) : null;
    if (r.brand === 'openaiCompatibility') {
      const extra = r.apiKeyEntryCount > 1 ? ` · +${r.apiKeyEntryCount - 1}` : '';
      return (
        <div className={styles.primaryCell}>
          <span className={styles.primaryName}>{r.name ?? r.identifier}</span>
          <div className={styles.primarySubRow}>
            <span className={styles.primarySub}>{(r.apiKeyPreview ?? '—') + extra}</span>
            {prefixEl}
          </div>
        </div>
      );
    }
    const secondary = [
      r.name ? (r.apiKeyPreview ?? '—') : null,
      r.authIndex ? `auth: ${r.authIndex}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    return (
      <div className={styles.primaryCell}>
        <span className={styles.primaryName}>{r.name ?? r.apiKeyPreview ?? '—'}</span>
        <div className={styles.primarySubRow}>
          {secondary ? <span className={styles.primarySub}>{secondary}</span> : null}
          {prefixEl}
        </div>
      </div>
    );
  };

  const renderBaseUrl = (r: ProviderResource) => {
    if (r.brand === 'claude' && !r.baseUrl) {
      return (
        <span className={styles.baseUrl}>
          https://api.anthropic.com {t('providersPage.status.defaultSuffix')}
        </span>
      );
    }
    return <span className={styles.baseUrl}>{r.baseUrl ?? t('providersPage.status.notSet')}</span>;
  };

  return (
    <Table
      className={styles.providerTable}
      cols={columnWidths.map((w, i) => (
        <col key={i} style={{ width: w }} />
      ))}
    >
      <TableHeader>
        <TableRow>
          <TableHead>{t('providersPage.table.key')}</TableHead>
          <TableHead>{t('providersPage.table.baseUrl')}</TableHead>
          <TableHead>{t('providersPage.table.models')}</TableHead>
          <TableHead>{t('providersPage.table.status')}</TableHead>
          <TableHead alignRight className={styles.actionsHead}>
            {t('providersPage.table.actions')}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {resources.map((resource) => {
          return (
            <TableRow key={resource.id} selected={resource.id === selectedId}>
              <TableCell>{renderPrimary(resource)}</TableCell>
              <TableCell>{renderBaseUrl(resource)}</TableCell>
              <TableCell>{renderModelsSummary(resource)}</TableCell>
              <TableCell>
                <div className={styles.statusCell}>
                  {renderStatus(resource)}
                  {usageByProvider ? (
                    <>
                      <div className={styles.statusBarWrap}>
                        <ProviderStatusBar
                          statusData={resolveStatusBarData(resource, usageByProvider)}
                          styles={statusBarStyles}
                        />
                      </div>
                      {(() => {
                        const stats = resolveTotalStats(resource, usageByProvider);
                        return (
                          <div className={styles.statsInline}>
                            <span className={`${styles.statDot} ${styles.statSuccessDot}`} />
                            <span className={styles.statNum}>{stats.success}</span>
                            <span className={`${styles.statDot} ${styles.statFailureDot}`} />
                            <span className={styles.statNum}>{stats.failure}</span>
                          </div>
                        );
                      })()}
                    </>
                  ) : null}
                </div>
              </TableCell>
              <TableCell
                alignRight
                className={[
                  styles.actionsCell,
                  resource.id === selectedId ? styles.actionsCellSelected : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className={styles.actions}>
                  {onToggleDisabled ? (
                    <span className={styles.toggleWrap} onClick={(e) => e.stopPropagation()}>
                      <ToggleSwitch
                        checked={!resource.disabled}
                        disabled={disableMutations}
                        onChange={(value) => onToggleDisabled(resource, !value)}
                        ariaLabel={
                          resource.disabled
                            ? t('providersPage.actions.enable')
                            : t('providersPage.actions.disable')
                        }
                      />
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className={styles.iconBtn}
                    aria-label={t('providersPage.actions.view')}
                    title={t('providersPage.actions.view')}
                    onClick={(e) => {
                      e.stopPropagation();
                      onView(resource);
                    }}
                  >
                    <IconEye size={16} />
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    aria-label={t('providersPage.actions.edit')}
                    title={t('providersPage.actions.edit')}
                    disabled={disableMutations}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(resource);
                    }}
                  >
                    <IconPencil size={16} />
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                    aria-label={t('providersPage.actions.delete')}
                    title={t('providersPage.actions.delete')}
                    disabled={disableMutations}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(resource);
                    }}
                  >
                    <IconTrash2 size={16} />
                  </button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
