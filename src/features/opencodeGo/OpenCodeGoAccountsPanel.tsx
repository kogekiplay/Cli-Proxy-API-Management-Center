import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconCheckCircle2, IconRefreshCw, IconTrash2 } from '@/components/ui/icons';
import { opencodeGoApi } from '@/services/api/opencodeGo';
import { useNotificationStore } from '@/stores';
import { formatQuotaResetTime } from '@/utils/quota';
import { useGridColumns } from '@/components/quota/useGridColumns';
import type { OpenCodeGoAccount, OpenCodeGoUsageWindow } from '@/types/opencodeGo';
import { displayOpenCodeGoAccountName } from './helpers';
import styles from './OpenCodeGoAccountsPanel.module.scss';
import quotaStyles from '@/pages/QuotaPage.module.scss';

interface OpenCodeGoAccountsPanelProps {
  disabled?: boolean;
}

type ViewMode = 'paged' | 'all';

const MAX_ITEMS_PER_PAGE = 25;
const MAX_SHOW_ALL_THRESHOLD = 30;

const usagePercent = (used?: number, limit?: number) => {
  if (!limit || limit <= 0 || used === undefined) return null;
  return Math.min(100, Math.max(0, (used / limit) * 100));
};

const remainingPercent = (used?: number, limit?: number) => {
  const usedPercent = usagePercent(used, limit);
  return usedPercent === null ? null : Math.max(0, Math.min(100, 100 - usedPercent));
};

const hasUsageWindow = (value: OpenCodeGoUsageWindow | undefined) =>
  value?.used !== undefined || value?.limit !== undefined || Boolean(value?.resetAt?.trim());

const hasUsageSnapshot = (account: OpenCodeGoAccount) =>
  hasUsageWindow(account.usage?.rolling) ||
  hasUsageWindow(account.usage?.weekly) ||
  hasUsageWindow(account.usage?.monthly);

export function OpenCodeGoAccountsPanel({ disabled = false }: OpenCodeGoAccountsPanelProps) {
  const { t } = useTranslation();
  const showNotification = useNotificationStore((state) => state.showNotification);

  const [accounts, setAccounts] = useState<OpenCodeGoAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyID, setBusyID] = useState<string | null>(null);
  const [usageBusyID, setUsageBusyID] = useState<string | null>(null);
  const [bulkRefreshing, setBulkRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('paged');
  const [page, setPage] = useState(1);
  const [showTooManyWarning, setShowTooManyWarning] = useState(false);
  const [columns, gridRef] = useGridColumns(380);

  const showAllAllowed = accounts.length <= MAX_SHOW_ALL_THRESHOLD;
  const effectiveViewMode: ViewMode = viewMode === 'all' && !showAllAllowed ? 'paged' : viewMode;
  const pageSize = useMemo(() => {
    if (effectiveViewMode === 'all') return Math.max(1, accounts.length);
    return Math.min(Math.max(1, columns * 3), MAX_ITEMS_PER_PAGE);
  }, [accounts.length, columns, effectiveViewMode]);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(accounts.length / pageSize)),
    [accounts.length, pageSize]
  );
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return accounts.slice(start, start + pageSize);
  }, [accounts, currentPage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [effectiveViewMode, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (showAllAllowed) return;
    if (viewMode !== 'all') return;
    setViewMode('paged');
    setShowTooManyWarning(true);
  }, [showAllAllowed, viewMode]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await opencodeGoApi.list();
      setAccounts(result.accounts);
    } catch (error) {
      showNotification(
        error instanceof Error ? error.message : t('opencode_go.load_failed'),
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, [showNotification, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const syncProvider = async (account: OpenCodeGoAccount) => {
    setBusyID(account.id);
    try {
      await opencodeGoApi.syncProvider(account.id);
      showNotification(t('opencode_go.provider_synced'), 'success');
      await load();
    } catch (error) {
      showNotification(
        error instanceof Error ? error.message : t('opencode_go.provider_sync_failed'),
        'error'
      );
    } finally {
      setBusyID(null);
    }
  };

  const refreshUsage = async (account: OpenCodeGoAccount) => {
    setUsageBusyID(account.id);
    try {
      const result = await opencodeGoApi.refreshUsage(account.id);
      const refreshedAccount = result.account;
      if (refreshedAccount) {
        setAccounts((items) =>
          items.map((item) => (item.id === refreshedAccount.id ? refreshedAccount : item))
        );
      } else {
        await load();
      }
      showNotification(t('opencode_go.usage_refreshed'), 'success');
    } catch (error) {
      showNotification(
        error instanceof Error ? error.message : t('opencode_go.usage_refresh_failed'),
        'error'
      );
    } finally {
      setUsageBusyID(null);
    }
  };

  const refreshVisibleUsage = async () => {
    const targets = effectiveViewMode === 'all' ? accounts : pageItems;
    const refreshable = targets.filter((account) => account.hasCookie);
    if (refreshable.length === 0) return;

    setBulkRefreshing(true);
    setUsageBusyID(null);
    let successCount = 0;
    let firstError = '';
    try {
      for (const account of refreshable) {
        try {
          const result = await opencodeGoApi.refreshUsage(account.id);
          const refreshedAccount = result.account;
          if (refreshedAccount) {
            setAccounts((items) =>
              items.map((item) => (item.id === refreshedAccount.id ? refreshedAccount : item))
            );
          }
          successCount += 1;
        } catch (error) {
          if (!firstError) {
            firstError =
              error instanceof Error ? error.message : t('opencode_go.usage_refresh_failed');
          }
        }
      }

      if (firstError) {
        showNotification(
          t('opencode_go.usage_refresh_all_partial', {
            success: successCount,
            failed: refreshable.length - successCount,
            message: firstError,
          }),
          'error'
        );
      } else {
        showNotification(
          t('opencode_go.usage_refresh_all_success', { count: successCount }),
          'success'
        );
      }
    } finally {
      setBulkRefreshing(false);
    }
  };

  const deleteAccount = async (account: OpenCodeGoAccount) => {
    if (
      !window.confirm(
        t('opencode_go.delete_confirm', { name: displayOpenCodeGoAccountName(account) })
      )
    ) {
      return;
    }
    setBusyID(account.id);
    try {
      await opencodeGoApi.deleteAccount(account.id, true);
      showNotification(t('opencode_go.deleted'), 'success');
      await load();
    } catch (error) {
      showNotification(
        error instanceof Error ? error.message : t('opencode_go.delete_failed'),
        'error'
      );
    } finally {
      setBusyID(null);
    }
  };

  const usageWindows = (account: OpenCodeGoAccount) => [
    { key: 'rolling', label: t('opencode_go.rolling'), value: account.usage?.rolling },
    { key: 'weekly', label: t('opencode_go.weekly'), value: account.usage?.weekly },
    { key: 'monthly', label: t('opencode_go.monthly'), value: account.usage?.monthly },
  ];

  const renderUsageWindow = (
    key: string,
    label: string,
    value: OpenCodeGoUsageWindow | undefined
  ) => {
    const percent = remainingPercent(value?.used, value?.limit);
    const hasValue = hasUsageWindow(value);
    const percentLabel = percent === null ? t('opencode_go.usage_empty') : `${Math.round(percent)}%`;

    return (
      <div className={styles.usageItem} key={key}>
        <div className={styles.usageHeader}>
          <span className={styles.usageLabel}>{label}</span>
          <div className={styles.usageMeta}>
            <strong>{hasValue ? percentLabel : t('opencode_go.usage_empty')}</strong>
            {value?.resetAt ? (
              <span>
                {t('opencode_go.reset_at', {
                  value: formatQuotaResetTime(value.resetAt),
                })}
              </span>
            ) : null}
          </div>
        </div>
        <div className={styles.meter} aria-hidden="true">
          <span style={{ width: `${percent ?? 0}%` }} />
        </div>
      </div>
    );
  };

  const titleNode = (
    <div className={styles.titleWrapper}>
      <span>{t('opencode_go.accounts_title')}</span>
      <span className={styles.countBadge}>{accounts.length}</span>
    </div>
  );
  const isRefreshing = loading || bulkRefreshing;
  const refreshTargets = effectiveViewMode === 'all' ? accounts : pageItems;
  const canRefreshVisible = refreshTargets.some((account) => account.hasCookie);

  return (
    <Card
      title={titleNode}
      extra={
        <div className={quotaStyles.headerActions}>
          <div className={quotaStyles.viewModeToggle}>
            <Button
              variant="secondary"
              size="sm"
              className={`${quotaStyles.viewModeButton} ${
                effectiveViewMode === 'paged' ? quotaStyles.viewModeButtonActive : ''
              }`}
              onClick={() => setViewMode('paged')}
            >
              {t('auth_files.view_mode_paged')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className={`${quotaStyles.viewModeButton} ${
                effectiveViewMode === 'all' ? quotaStyles.viewModeButtonActive : ''
              }`}
              onClick={() => {
                if (accounts.length > MAX_SHOW_ALL_THRESHOLD) {
                  setShowTooManyWarning(true);
                } else {
                  setViewMode('all');
                }
              }}
            >
              {t('auth_files.view_mode_all')}
            </Button>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className={quotaStyles.refreshAllButton}
            onClick={refreshVisibleUsage}
            disabled={disabled || isRefreshing || !canRefreshVisible}
            loading={isRefreshing}
            title={t('quota_management.refresh_all_credentials')}
            aria-label={t('quota_management.refresh_all_credentials')}
          >
            <span className={styles.buttonContent}>
              {!isRefreshing && <IconRefreshCw size={16} />}
              <span>{t('quota_management.refresh_all_credentials')}</span>
            </span>
          </Button>
        </div>
      }
    >
      <div ref={gridRef} className={styles.accountList}>
        {accounts.length === 0 && !loading ? (
          <div className={styles.empty}>{t('opencode_go.empty_quota')}</div>
        ) : null}

        {pageItems.map((account) => {
          const usageLoading = usageBusyID === account.id || bulkRefreshing;
          const canRefreshUsage = !disabled && !usageLoading && account.hasCookie;

          return (
            <article className={styles.accountCard} key={account.id}>
              <div className={styles.cardHeader}>
                <span className={styles.typeBadge}>OpenCode Go</span>
                <span className={styles.fileName}>{displayOpenCodeGoAccountName(account)}</span>
              </div>

              <div className={styles.planLine}>
                <span className={styles.planLabel}>{t('opencode_go.plan_label')}</span>
                <span className={styles.planValue}>OpenCode Go</span>
              </div>

              {hasUsageSnapshot(account) ? (
                <div className={styles.quotaSection}>
                  {usageWindows(account).map((item) =>
                    renderUsageWindow(item.key, item.label, item.value)
                  )}
                  <div className={styles.quotaActions}>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => refreshUsage(account)}
                      disabled={!canRefreshUsage}
                      loading={usageLoading}
                    >
                      <span className={styles.buttonContent}>
                        {!usageLoading && <IconRefreshCw size={15} />}
                        <span>{t('opencode_go.refresh_usage')}</span>
                      </span>
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className={`${styles.quotaSection} ${styles.quotaIdleButton}`}
                  onClick={() => refreshUsage(account)}
                  disabled={!canRefreshUsage}
                >
                  {usageLoading ? t('opencode_go.usage_refreshing') : t('opencode_go.idle')}
                </button>
              )}

              <div className={styles.badges}>
                <span className={account.hasApiKey ? styles.badgeOk : styles.badgeWarn}>
                  {account.apiKeyPreview || t('opencode_go.no_api_key')}
                </span>
                <span className={account.hasCookie ? styles.badgeOk : styles.badgeMuted}>
                  {account.hasCookie
                    ? t('opencode_go.cookie_saved')
                    : t('opencode_go.cookie_missing')}
                </span>
                <span className={account.apiKeySynced ? styles.badgeOk : styles.badgeWarn}>
                  {account.apiKeySynced
                    ? t('opencode_go.provider_synced_status')
                    : t('opencode_go.provider_not_synced')}
                </span>
                <span className={account.providerKeyManaged ? styles.badgeOk : styles.badgeMuted}>
                  {account.providerKeyManaged
                    ? t('opencode_go.provider_key_managed')
                    : t('opencode_go.provider_key_manual')}
                </span>
              </div>

              {account.providerSyncError ? (
                <p className={styles.error}>{account.providerSyncError}</p>
              ) : null}

              <div className={styles.actions}>
                <Button
                  size="sm"
                  onClick={() => syncProvider(account)}
                  disabled={disabled || busyID === account.id || !account.hasApiKey}
                  loading={busyID === account.id}
                >
                  <span className={styles.buttonContent}>
                    <IconCheckCircle2 size={15} />
                    <span>{t('opencode_go.sync_provider')}</span>
                  </span>
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => deleteAccount(account)}
                  disabled={disabled || busyID === account.id}
                >
                  <span className={styles.buttonContent}>
                    <IconTrash2 size={15} />
                    <span>{t('common.delete')}</span>
                  </span>
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      {accounts.length > pageSize && effectiveViewMode === 'paged' && (
        <div className={quotaStyles.pagination}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={currentPage <= 1}
          >
            {t('auth_files.pagination_prev')}
          </Button>
          <div className={quotaStyles.pageInfo}>
            {t('auth_files.pagination_info', {
              current: currentPage,
              total: totalPages,
              count: accounts.length,
            })}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={currentPage >= totalPages}
          >
            {t('auth_files.pagination_next')}
          </Button>
        </div>
      )}
      {showTooManyWarning && (
        <div className={quotaStyles.warningOverlay} onClick={() => setShowTooManyWarning(false)}>
          <div className={quotaStyles.warningModal} onClick={(event) => event.stopPropagation()}>
            <p>{t('auth_files.too_many_files_warning')}</p>
            <Button variant="primary" size="sm" onClick={() => setShowTooManyWarning(false)}>
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
