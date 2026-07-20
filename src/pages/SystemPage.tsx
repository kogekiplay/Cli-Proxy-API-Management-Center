import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import {
  IconBookOpen,
  IconChevronDown,
  IconCode,
  IconExternalLink,
  IconRefreshCw,
  IconTrash2,
} from '@/components/ui/icons';
import {
  useAuthStore,
  useConfigStore,
  useNotificationStore,
  useModelsStore,
  useThemeStore,
} from '@/stores';
import { configApi, versionApi } from '@/services/api';
import { useApiKeysForModels } from '@/hooks/useApiKeysForModels';
import { formatDateTimeValue } from '@/utils/format';
import { classifyModels } from '@/utils/models';
import { STORAGE_KEY_AUTH } from '@/utils/constants';
import logoImage from '@/assets/logo.jpg';
import iconGemini from '@/assets/icons/gemini.svg';
import iconClaude from '@/assets/icons/claude.svg';
import iconOpenaiLight from '@/assets/icons/openai-light.svg';
import iconOpenaiDark from '@/assets/icons/openai-dark.svg';
import iconQwen from '@/assets/icons/qwen.svg';
import iconKimiLight from '@/assets/icons/kimi-light.svg';
import iconKimiDark from '@/assets/icons/kimi-dark.svg';
import iconGlm from '@/assets/icons/glm.svg';
import iconGrok from '@/assets/icons/grok.svg';
import iconGrokDark from '@/assets/icons/grok-dark.svg';
import iconDeepseek from '@/assets/icons/deepseek.svg';
import iconMinimax from '@/assets/icons/minimax.svg';
import styles from './SystemPage.module.scss';

const MODEL_TAG_PREVIEW_LIMIT = 6;

const MODEL_CATEGORY_ICONS: Record<string, string | { light: string; dark: string }> = {
  gpt: { light: iconOpenaiLight, dark: iconOpenaiDark },
  claude: iconClaude,
  gemini: iconGemini,
  qwen: iconQwen,
  kimi: { light: iconKimiDark, dark: iconKimiLight },
  glm: iconGlm,
  grok: { light: iconGrok, dark: iconGrokDark },
  deepseek: iconDeepseek,
  minimax: iconMinimax,
};

const MODEL_CATEGORY_SUBTITLES: Record<string, string> = {
  gpt: 'OpenAI',
  claude: 'Anthropic',
  gemini: 'Google',
  qwen: 'Alibaba',
  kimi: 'Moonshot',
  glm: '智谱',
  grok: 'xAI',
  deepseek: '深度求索',
  minimax: 'MiniMax',
  other: 'Other',
};

const parseVersionSegments = (version?: string | null) => {
  if (!version) return null;
  const cleaned = version.trim().replace(/^v/i, '');
  if (!cleaned) return null;
  const parts = cleaned
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((segment) => Number.parseInt(segment, 10))
    .filter(Number.isFinite);
  return parts.length ? parts : null;
};

const compareVersions = (latest?: string | null, current?: string | null) => {
  const latestParts = parseVersionSegments(latest);
  const currentParts = parseVersionSegments(current);
  if (!latestParts || !currentParts) return null;
  const length = Math.max(latestParts.length, currentParts.length);
  for (let i = 0; i < length; i++) {
    const l = latestParts[i] || 0;
    const c = currentParts[i] || 0;
    if (l > c) return 1;
    if (l < c) return -1;
  }
  return 0;
};

export function SystemPage() {
  const { t, i18n } = useTranslation();
  const { showNotification, showConfirmation } = useNotificationStore();
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const auth = useAuthStore();
  const config = useConfigStore((state) => state.config);
  const fetchConfig = useConfigStore((state) => state.fetchConfig);
  const clearCache = useConfigStore((state) => state.clearCache);
  const updateConfigValue = useConfigStore((state) => state.updateConfigValue);

  const models = useModelsStore((state) => state.models);
  const modelsLoading = useModelsStore((state) => state.loading);
  const modelsError = useModelsStore((state) => state.error);
  const fetchModelsFromStore = useModelsStore((state) => state.fetchModels);

  const [modelStatus, setModelStatus] = useState<{
    type: 'success' | 'warning' | 'error' | 'muted';
    message: string;
  }>();
  const [expandedModelGroups, setExpandedModelGroups] = useState<Set<string>>(new Set());
  const [requestLogModalOpen, setRequestLogModalOpen] = useState(false);
  const [requestLogDraft, setRequestLogDraft] = useState(false);
  const [requestLogTouched, setRequestLogTouched] = useState(false);
  const [requestLogSaving, setRequestLogSaving] = useState(false);
  const [checkingVersion, setCheckingVersion] = useState(false);

  const versionTapCount = useRef(0);
  const versionTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const otherLabel = useMemo(
    () => (i18n.language?.toLowerCase().startsWith('zh') ? '其他' : 'Other'),
    [i18n.language]
  );
  const groupedModels = useMemo(() => classifyModels(models, { otherLabel }), [models, otherLabel]);
  const requestLogEnabled = config?.requestLog ?? false;
  const requestLogDirty = requestLogDraft !== requestLogEnabled;
  const canEditRequestLog = auth.connectionStatus === 'connected' && Boolean(config);

  const appVersion = __APP_VERSION__ || t('system_info.version_unknown');
  const apiVersion = auth.serverVersion || t('system_info.version_unknown');
  const buildTime =
    formatDateTimeValue(auth.serverBuildDate, i18n.language) || t('system_info.version_unknown');
  const connectionLabel = t(`common.${auth.connectionStatus}_status`);
  const currentYear = new Date().getFullYear();

  const getIconForCategory = (categoryId: string): string | null => {
    const iconEntry = MODEL_CATEGORY_ICONS[categoryId];
    if (!iconEntry) return null;
    if (typeof iconEntry === 'string') return iconEntry;
    return resolvedTheme === 'dark' ? iconEntry.dark : iconEntry.light;
  };

  const toggleModelGroup = (groupId: string) => {
    setExpandedModelGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const resolveApiKeysForModels = useApiKeysForModels();

  const fetchModels = async ({ forceRefresh = false }: { forceRefresh?: boolean } = {}) => {
    if (auth.connectionStatus !== 'connected') {
      setModelStatus({
        type: 'warning',
        message: t('notification.connection_required'),
      });
      return;
    }

    if (!auth.apiBase) {
      showNotification(t('notification.connection_required'), 'warning');
      return;
    }

    setModelStatus({ type: 'muted', message: t('system_info.models_loading') });
    try {
      const apiKeys = await resolveApiKeysForModels({ force: forceRefresh });
      const primaryKey = apiKeys[0];
      const list = await fetchModelsFromStore(auth.apiBase, primaryKey, forceRefresh);
      const hasModels = list.length > 0;
      setModelStatus({
        type: hasModels ? 'success' : 'warning',
        message: hasModels
          ? t('system_info.models_count', { count: list.length })
          : t('system_info.models_empty'),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
      const suffix = message ? `: ${message}` : '';
      const text = `${t('system_info.models_error')}${suffix}`;
      setModelStatus({ type: 'error', message: text });
    }
  };

  const handleClearLoginStorage = () => {
    showConfirmation({
      title: t('system_info.clear_login_title', { defaultValue: 'Clear Login Storage' }),
      message: t('system_info.clear_login_confirm'),
      variant: 'danger',
      confirmText: t('common.confirm'),
      onConfirm: () => {
        auth.logout();
        if (typeof localStorage === 'undefined') return;
        const keysToRemove = [STORAGE_KEY_AUTH, 'isLoggedIn', 'apiBase', 'apiUrl', 'managementKey'];
        keysToRemove.forEach((key) => localStorage.removeItem(key));
        showNotification(t('notification.login_storage_cleared'), 'success');
      },
    });
  };

  const openRequestLogModal = useCallback(() => {
    setRequestLogTouched(false);
    setRequestLogDraft(requestLogEnabled);
    setRequestLogModalOpen(true);
  }, [requestLogEnabled]);

  const handleInfoVersionTap = useCallback(() => {
    versionTapCount.current += 1;
    if (versionTapTimer.current) {
      clearTimeout(versionTapTimer.current);
    }

    if (versionTapCount.current >= 7) {
      versionTapCount.current = 0;
      versionTapTimer.current = null;
      openRequestLogModal();
      return;
    }

    versionTapTimer.current = setTimeout(() => {
      versionTapCount.current = 0;
      versionTapTimer.current = null;
    }, 1500);
  }, [openRequestLogModal]);

  const handleRequestLogClose = useCallback(() => {
    setRequestLogModalOpen(false);
    setRequestLogTouched(false);
  }, []);

  const handleRequestLogSave = async () => {
    if (!canEditRequestLog) return;
    if (!requestLogDirty) {
      setRequestLogModalOpen(false);
      return;
    }

    const previous = requestLogEnabled;
    setRequestLogSaving(true);
    updateConfigValue('request-log', requestLogDraft);

    try {
      await configApi.updateRequestLog(requestLogDraft);
      clearCache('request-log');
      showNotification(t('notification.request_log_updated'), 'success');
      setRequestLogModalOpen(false);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : typeof error === 'string' ? error : '';
      updateConfigValue('request-log', previous);
      showNotification(
        `${t('notification.update_failed')}${message ? `: ${message}` : ''}`,
        'error'
      );
    } finally {
      setRequestLogSaving(false);
    }
  };

  const handleVersionCheck = useCallback(async () => {
    setCheckingVersion(true);
    try {
      const data = await versionApi.checkLatest();
      const latestRaw = data?.['latest-version'] ?? data?.latest_version ?? data?.latest ?? '';
      const latest = typeof latestRaw === 'string' ? latestRaw : String(latestRaw ?? '');
      const comparison = compareVersions(latest, auth.serverVersion);

      if (!latest) {
        showNotification(t('system_info.version_check_error'), 'error');
        return;
      }

      if (comparison === null) {
        showNotification(t('system_info.version_current_missing'), 'warning');
        return;
      }

      if (comparison > 0) {
        showNotification(t('system_info.version_update_available', { version: latest }), 'warning');
      } else {
        showNotification(t('system_info.version_is_latest'), 'success');
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : typeof error === 'string' ? error : '';
      const suffix = message ? `: ${message}` : '';
      showNotification(`${t('system_info.version_check_error')}${suffix}`, 'error');
    } finally {
      setCheckingVersion(false);
    }
  }, [auth.serverVersion, showNotification, t]);

  useEffect(() => {
    fetchConfig().catch(() => {
      // ignore
    });
  }, [fetchConfig]);

  useEffect(() => {
    if (requestLogModalOpen && !requestLogTouched) {
      setRequestLogDraft(requestLogEnabled);
    }
  }, [requestLogModalOpen, requestLogTouched, requestLogEnabled]);

  useEffect(() => {
    return () => {
      if (versionTapTimer.current) {
        clearTimeout(versionTapTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    fetchModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.connectionStatus, auth.apiBase]);

  return (
    <div className={styles.container}>
      <header className={styles.pageHeader}>
        <p className="page-eyebrow">{t('nav_meta.system_info')}</p>
        <h1>{t('system_info.title')}</h1>
        <p>
          {t('system_info.page_desc', {
            defaultValue: '查看系统运行信息、可用模型、快速连接与本地资源。',
          })}
        </p>
      </header>

      <div className={styles.content}>
        <section className={`${styles.panelCard} ${styles.systemHero}`}>
          <h2>{t('system_info.overview_title', { defaultValue: '系统概览' })}</h2>

          <div className={styles.heroIdentity}>
            <img src={logoImage} alt="CPAMC" className={styles.heroLogo} />
            <div>
              <h3>{t('system_info.about_title')}</h3>
              <p>
                {t('system_info.about_desc', {
                  defaultValue: '集中管理 API 网关、模型路由、认证凭证与用量监控。',
                })}
              </p>
            </div>
          </div>

          <div className={styles.infoGrid}>
            <button
              type="button"
              className={`${styles.infoTile} ${styles.tapTile}`}
              onClick={handleInfoVersionTap}
            >
              <span>{t('footer.version')}</span>
              <strong>{appVersion}</strong>
            </button>

            <div className={styles.infoTile}>
              <div className={styles.tileHeader}>
                <span>{t('footer.api_version')}</span>
                <button
                  type="button"
                  className={styles.inlineAction}
                  onClick={() => void handleVersionCheck()}
                  disabled={checkingVersion}
                  title={t('system_info.version_check_button')}
                  aria-label={t('system_info.version_check_button')}
                >
                  {t('system_info.version_check_button')}
                  <IconRefreshCw
                    className={checkingVersion ? styles.spinIcon : undefined}
                    size={15}
                  />
                </button>
              </div>
              <strong>{apiVersion}</strong>
            </div>

            <div className={styles.infoTile}>
              <span>{t('footer.build_date')}</span>
              <strong>{buildTime}</strong>
            </div>

            <div className={styles.infoTile}>
              <span>{t('connection.status')}</span>
              <strong className={styles.connectionValue}>
                <span
                  className={`${styles.statusDot} ${styles[auth.connectionStatus] ?? ''}`}
                  aria-hidden="true"
                />
                {connectionLabel}
              </strong>
              <small>{auth.apiBase || '-'}</small>
            </div>
          </div>
        </section>

        <section className={styles.panelCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>{t('system_info.quick_links_title')}</h2>
              <p>{t('system_info.quick_links_desc')}</p>
            </div>
          </div>

          <div className={styles.quickLinkGrid}>
            <a
              href="https://github.com/router-for-me/CLIProxyAPI"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.quickLinkCard}
            >
              <span className={`${styles.quickLinkIcon} ${styles.darkIcon}`}>
                <IconCode size={20} />
              </span>
              <span>
                <strong>{t('system_info.link_main_repo')}</strong>
                <small>{t('system_info.link_main_repo_desc')}</small>
              </span>
              <IconExternalLink size={15} />
            </a>

            <a
              href="https://github.com/router-for-me/Cli-Proxy-API-Management-Center"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.quickLinkCard}
            >
              <span className={`${styles.quickLinkIcon} ${styles.darkIcon}`}>
                <IconCode size={20} />
              </span>
              <span>
                <strong>{t('system_info.link_webui_repo')}</strong>
                <small>{t('system_info.link_webui_repo_desc')}</small>
              </span>
              <IconExternalLink size={15} />
            </a>

            <a
              href="https://help.router-for.me/"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.quickLinkCard}
            >
              <span className={`${styles.quickLinkIcon} ${styles.docsIcon}`}>
                <IconBookOpen size={20} />
              </span>
              <span>
                <strong>{t('system_info.link_docs')}</strong>
                <small>{t('system_info.link_docs_desc')}</small>
              </span>
              <IconExternalLink size={15} />
            </a>
          </div>
        </section>

        <section className={styles.panelCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>{t('system_info.models_title')}</h2>
              <p>{t('system_info.models_desc')}</p>
            </div>
            <button
              type="button"
              className={styles.refreshButton}
              onClick={() => fetchModels({ forceRefresh: true })}
              disabled={modelsLoading}
            >
              <IconRefreshCw className={modelsLoading ? styles.spinIcon : undefined} size={15} />
              {t('common.refresh')}
            </button>
          </div>

          <div className={styles.modelsToolbar}>
            <span className={styles.modelsCountPill}>
              {t('system_info.models_count', { count: models.length })}
            </span>
            {modelStatus && modelStatus.type !== 'success' && (
              <span className={`${styles.modelStatus} ${styles[modelStatus.type]}`}>
                {modelStatus.message}
              </span>
            )}
          </div>

          {modelsError && <div className={styles.errorBox}>{modelsError}</div>}
          {modelsLoading ? (
            <div className={styles.emptyState}>{t('common.loading')}</div>
          ) : models.length === 0 ? (
            <div className={styles.emptyState}>{t('system_info.models_empty')}</div>
          ) : (
            <div className={styles.modelGroupList}>
              {groupedModels.map((group) => {
                const iconSrc = getIconForCategory(group.id);
                const expanded = expandedModelGroups.has(group.id);
                const visibleModels = expanded
                  ? group.items
                  : group.items.slice(0, MODEL_TAG_PREVIEW_LIMIT);
                const hiddenCount = Math.max(0, group.items.length - visibleModels.length);

                return (
                  <div key={group.id} className={styles.modelGroupRow}>
                    <div className={styles.modelProvider}>
                      <span className={styles.modelIconShell}>
                        {iconSrc ? (
                          <img src={iconSrc} alt="" className={styles.groupIcon} />
                        ) : (
                          <IconCode size={18} />
                        )}
                      </span>
                      <span>
                        <strong>{group.label}</strong>
                        <small>{MODEL_CATEGORY_SUBTITLES[group.id] ?? group.id}</small>
                      </span>
                    </div>

                    <div className={styles.modelTags}>
                      {visibleModels.map((model) => (
                        <span
                          key={`${model.name}-${model.alias ?? 'default'}`}
                          className={styles.modelTag}
                          title={model.description || model.alias || model.name}
                        >
                          <span className={styles.modelName}>{model.name}</span>
                          {model.alias && <span className={styles.modelAlias}>{model.alias}</span>}
                        </span>
                      ))}
                      {hiddenCount > 0 && (
                        <button
                          type="button"
                          className={styles.moreModels}
                          onClick={() => toggleModelGroup(group.id)}
                        >
                          +{hiddenCount}
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      className={styles.modelGroupToggle}
                      onClick={() => toggleModelGroup(group.id)}
                      aria-expanded={expanded}
                    >
                      <span>{t('system_info.models_count', { count: group.items.length })}</span>
                      <IconChevronDown
                        className={expanded ? styles.chevronOpen : undefined}
                        size={15}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className={`${styles.panelCard} ${styles.localResourceCard}`}>
          <div>
            <h2>{t('system_info.clear_login_title')}</h2>
            <p>{t('system_info.clear_login_desc')}</p>
          </div>
          <Button variant="danger" onClick={handleClearLoginStorage} className={styles.clearButton}>
            <IconTrash2 size={15} />
            {t('system_info.clear_login_button')}
          </Button>
        </section>

        <footer className={styles.systemFooter}>
          <span>© {currentYear} CPA System. All rights reserved.</span>
          <span>{t('dashboard.timezone', { defaultValue: '时区' })}: Asia/Shanghai</span>
        </footer>
      </div>

      <Modal
        open={requestLogModalOpen}
        onClose={handleRequestLogClose}
        title={t('basic_settings.request_log_title')}
        footer={
          <>
            <Button variant="secondary" onClick={handleRequestLogClose} disabled={requestLogSaving}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleRequestLogSave}
              loading={requestLogSaving}
              disabled={!canEditRequestLog || !requestLogDirty}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="request-log-modal">
          <div className="status-badge warning">{t('basic_settings.request_log_warning')}</div>
          <ToggleSwitch
            label={t('basic_settings.request_log_enable')}
            labelPosition="left"
            checked={requestLogDraft}
            disabled={!canEditRequestLog || requestLogSaving}
            onChange={(value) => {
              setRequestLogDraft(value);
              setRequestLogTouched(true);
            }}
          />
        </div>
      </Modal>
    </div>
  );
}
