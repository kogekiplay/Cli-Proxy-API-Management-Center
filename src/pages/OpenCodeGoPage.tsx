import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconCheckCircle2, IconRefreshCw, IconTrash2 } from '@/components/ui/icons';
import { opencodeGoApi } from '@/services/api/opencodeGo';
import { useAuthStore, useNotificationStore } from '@/stores';
import { copyToClipboard } from '@/utils/clipboard';
import { formatDateTimeValue, formatDateValue } from '@/utils/format';
import type { OpenCodeGoAccount, OpenCodeGoUsageWindow } from '@/types/opencodeGo';
import styles from './OpenCodeGoPage.module.scss';

const usagePercent = (used?: number, limit?: number) => {
  if (!limit || limit <= 0 || used === undefined) return null;
  return Math.min(100, Math.max(0, (used / limit) * 100));
};

const displayName = (account: OpenCodeGoAccount) =>
  account.alias || account.email || account.username || account.workspaceId || account.id;

const resolveManagementBase = (apiBase: string, managementBase: string) => {
  const configured = managementBase.trim();
  if (/^https?:\/\//i.test(configured)) {
    return configured.replace(/\/+$/, '');
  }

  const base = (apiBase || window.location.origin).replace(/\/+$/, '');
  const path = configured || '/v0/management';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`.replace(/\/+$/, '');
};

export function OpenCodeGoPage() {
  const { t, i18n } = useTranslation();
  const apiBase = useAuthStore((state) => state.apiBase);
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const showNotification = useNotificationStore((state) => state.showNotification);

  const [accounts, setAccounts] = useState<OpenCodeGoAccount[]>([]);
  const [providerName, setProviderName] = useState('opencode-go');
  const [baseUrl, setBaseUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyID, setBusyID] = useState<string | null>(null);
  const [copyingConfig, setCopyingConfig] = useState(false);

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
      setProviderName(result.providerName);
      setBaseUrl(result.baseUrl);
      setAccounts(result.accounts);
    } catch (error) {
      showNotification(error instanceof Error ? error.message : t('opencode_go.load_failed'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyConfig = async () => {
    setCopyingConfig(true);
    try {
      const config = await opencodeGoApi.userscriptConfig();
      const configText = JSON.stringify(
        {
          scriptName: config.name,
          match: config.match,
          cpaManagementBase: resolveManagementBase(apiBase, config.managementBase),
          managementKey: '<填写你的 CPA 管理密钥>',
          endpoints: config.endpoints,
        },
        null,
        2
      );
      const ok = await copyToClipboard(configText);
      showNotification(
        ok ? t('opencode_go.config_copied') : t('notification.copy_failed'),
        ok ? 'success' : 'error'
      );
    } catch (error) {
      showNotification(
        error instanceof Error ? error.message : t('opencode_go.config_copy_failed'),
        'error'
      );
    } finally {
      setCopyingConfig(false);
    }
  };

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
    if (!window.confirm(t('opencode_go.delete_confirm', { name: displayName(account) }))) return;
    setBusyID(account.id);
    try {
      await opencodeGoApi.deleteAccount(account.id, true);
      showNotification(t('opencode_go.deleted'), 'success');
      await load();
    } catch (error) {
      showNotification(error instanceof Error ? error.message : t('opencode_go.delete_failed'), 'error');
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
    const hasValue =
      value?.used !== undefined || value?.limit !== undefined || Boolean(value?.resetAt?.trim());

    return (
      <div className={styles.usageItem} key={key}>
        <div className={styles.usageHeader}>
          <span>{label}</span>
          <strong>
            {hasValue
              ? `${formatUsageNumber(value?.used)} / ${formatUsageNumber(value?.limit)}`
              : t('opencode_go.usage_empty')}
          </strong>
        </div>
        <div className={styles.meter} aria-hidden="true">
          <span style={{ width: `${percent ?? 0}%` }} />
        </div>
        <small>
          {value?.resetAt
            ? t('opencode_go.reset_at', {
                value: formatDateValue(value.resetAt, i18n.language),
              })
            : '\u00a0'}
        </small>
      </div>
    );
  };

  const titleNode = (
    <div className={styles.titleWrapper}>
      <span>{t('opencode_go.accounts_title')}</span>
      <span className={styles.countBadge}>{accounts.length}</span>
    </div>
  );

  const controlsDisabled = connectionStatus !== 'connected';

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>{t('opencode_go.title')}</h1>
        <p className={styles.description}>{t('opencode_go.subtitle')}</p>
      </div>

      <Card
        title={titleNode}
        extra={
          <div className={styles.headerActions}>
            <Button
              variant="secondary"
              size="sm"
              onClick={copyConfig}
              disabled={controlsDisabled || copyingConfig}
              loading={copyingConfig}
            >
              {t('opencode_go.copy_config')}
            </Button>
            <Button
              size="sm"
              onClick={load}
              disabled={controlsDisabled || loading}
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
        <div className={styles.providerBar}>
          <span>
            <strong>{t('opencode_go.provider_name')}</strong>
            {providerName}
          </span>
          <span>
            <strong>{t('opencode_go.base_url')}</strong>
            {baseUrl || t('opencode_go.base_url_missing')}
          </span>
        </div>

        <div className={styles.accountList}>
          {accounts.length === 0 && !loading ? (
            <div className={styles.empty}>{t('opencode_go.empty')}</div>
          ) : null}

          {accounts.map((account) => (
            <article className={styles.accountCard} key={account.id}>
              <div className={styles.accountMain}>
                <div className={styles.accountIdentity}>
                  <h2>{displayName(account)}</h2>
                  <p>{account.email || account.username || account.workspaceId || account.id}</p>
                </div>

                <div className={styles.badges}>
                  <span className={account.hasApiKey ? styles.badgeOk : styles.badgeWarn}>
                    {account.apiKeyPreview || t('opencode_go.no_api_key')}
                  </span>
                  <span className={account.hasCookie ? styles.badgeOk : styles.badgeMuted}>
                    {account.hasCookie ? t('opencode_go.cookie_saved') : t('opencode_go.cookie_missing')}
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
              </div>

              <div className={styles.usageGrid}>
                {usageWindows(account).map((item) =>
                  renderUsageWindow(item.key, item.label, item.value)
                )}
              </div>

              {account.providerSyncError ? (
                <p className={styles.error}>{account.providerSyncError}</p>
              ) : null}

              <div className={styles.meta}>
                <span>
                  {t('opencode_go.workspace_id')}: {account.workspaceId || '-'}
                </span>
                <span>
                  {t('opencode_go.provider')}: {account.providerName || providerName}
                </span>
                <span>
                  {t('opencode_go.last_sync')}:{' '}
                  {formatDateTimeValue(account.lastSyncedAt, i18n.language) || '-'}
                </span>
              </div>

              <div className={styles.actions}>
                <Button
                  size="sm"
                  onClick={() => syncProvider(account)}
                  disabled={controlsDisabled || busyID === account.id || !account.hasApiKey}
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
                  disabled={controlsDisabled || busyID === account.id}
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
    </div>
  );
}
