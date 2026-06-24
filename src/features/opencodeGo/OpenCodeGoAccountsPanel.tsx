import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconCheckCircle2, IconRefreshCw, IconTrash2 } from '@/components/ui/icons';
import { opencodeGoApi } from '@/services/api/opencodeGo';
import { useNotificationStore } from '@/stores';
import { formatDateValue } from '@/utils/format';
import type { OpenCodeGoAccount, OpenCodeGoUsageWindow } from '@/types/opencodeGo';
import { displayOpenCodeGoAccountName } from './helpers';
import styles from './OpenCodeGoAccountsPanel.module.scss';

interface OpenCodeGoAccountsPanelProps {
  disabled?: boolean;
}

const usagePercent = (used?: number, limit?: number) => {
  if (!limit || limit <= 0 || used === undefined) return null;
  return Math.min(100, Math.max(0, (used / limit) * 100));
};

const hasUsageWindow = (value: OpenCodeGoUsageWindow | undefined) =>
  value?.used !== undefined || value?.limit !== undefined || Boolean(value?.resetAt?.trim());

const hasUsageSnapshot = (account: OpenCodeGoAccount) =>
  hasUsageWindow(account.usage?.rolling) ||
  hasUsageWindow(account.usage?.weekly) ||
  hasUsageWindow(account.usage?.monthly);

export function OpenCodeGoAccountsPanel({ disabled = false }: OpenCodeGoAccountsPanelProps) {
  const { t, i18n } = useTranslation();
  const showNotification = useNotificationStore((state) => state.showNotification);

  const [accounts, setAccounts] = useState<OpenCodeGoAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyID, setBusyID] = useState<string | null>(null);

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language, {
        maximumFractionDigits: 2,
      }),
    [i18n.language]
  );

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

  const formatUsageNumber = (value?: number) =>
    value === undefined || value === null ? '-' : formatter.format(value);

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
    const percent = usagePercent(value?.used, value?.limit);
    const hasValue = hasUsageWindow(value);

    return (
      <div className={styles.usageItem} key={key}>
        <div className={styles.usageHeader}>
          <span className={styles.usageLabel}>{label}</span>
          <div className={styles.usageMeta}>
            <strong>
              {hasValue
                ? `${formatUsageNumber(value?.used)} / ${formatUsageNumber(value?.limit)}`
                : t('opencode_go.usage_empty')}
            </strong>
            {value?.resetAt ? (
              <span>
                {t('opencode_go.reset_at', {
                  value: formatDateValue(value.resetAt, i18n.language),
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

  return (
    <Card
      title={titleNode}
      extra={
        <div className={styles.headerActions}>
          <Button
            size="sm"
            variant="secondary"
            onClick={load}
            disabled={disabled || loading}
            loading={loading}
          >
            <span className={styles.buttonContent}>
              <IconRefreshCw size={15} />
              <span>{t('common.refresh')}</span>
            </span>
          </Button>
        </div>
      }
    >
      <div className={styles.accountList}>
        {accounts.length === 0 && !loading ? (
          <div className={styles.empty}>{t('opencode_go.empty_quota')}</div>
        ) : null}

        {accounts.map((account) => (
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
              </div>
            ) : (
              <button
                type="button"
                className={`${styles.quotaSection} ${styles.quotaIdleButton}`}
                onClick={load}
                disabled={disabled || loading}
              >
                {t('opencode_go.idle')}
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
        ))}
      </div>
    </Card>
  );
}
