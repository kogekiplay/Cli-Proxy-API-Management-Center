import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IconKey,
  IconBot,
  IconFileText,
  IconSatellite,
  IconInbox,
  IconInfo,
  IconRefreshCw,
  IconChevronDown,
  IconChevronLeft,
} from '@/components/ui/icons';
import { useAuthStore, useConfigStore, useModelsStore } from '@/stores';
import { authFilesApi } from '@/services/api';
import { useApiKeysForModels } from '@/hooks/useApiKeysForModels';
import { formatDateValue } from '@/utils/format';
import styles from './DashboardPage.module.scss';

interface QuickStat {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  path: string;
  loading?: boolean;
  sublabel?: string;
}

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const serverVersion = useAuthStore((state) => state.serverVersion);
  const serverBuildDate = useAuthStore((state) => state.serverBuildDate);
  const apiBase = useAuthStore((state) => state.apiBase);
  const config = useConfigStore((state) => state.config);
  const fetchConfig = useConfigStore((state) => state.fetchConfig);

  const models = useModelsStore((state) => state.models);
  const modelsLoading = useModelsStore((state) => state.loading);
  const fetchModelsFromStore = useModelsStore((state) => state.fetchModels);

  const [authFilesCount, setAuthFilesCount] = useState<number | null>(null);
  const [authFilesLoading, setAuthFilesLoading] = useState(false);

  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => {
      setCurrentTime(new Date());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const resolveApiKeysForModels = useApiKeysForModels();

  const fetchModels = useCallback(async () => {
    if (connectionStatus !== 'connected' || !apiBase) {
      return;
    }

    try {
      const apiKeys = await resolveApiKeysForModels();
      const primaryKey = apiKeys[0];
      await fetchModelsFromStore(apiBase, primaryKey);
    } catch {
      // Ignore model fetch errors on dashboard
    }
  }, [connectionStatus, apiBase, resolveApiKeysForModels, fetchModelsFromStore]);

  useEffect(() => {
    if (connectionStatus !== 'connected') {
      return;
    }

    let cancelled = false;

    const loadAuthFiles = async () => {
      setAuthFilesLoading(true);
      try {
        const res = await authFilesApi.list();
        if (!cancelled) setAuthFilesCount(res.files.length);
      } catch {
        if (!cancelled) setAuthFilesCount(null);
      } finally {
        setAuthFilesLoading(false);
      }
    };

    // 提供商/密钥统计直接来自 config store；这里只需保证配置已加载并取认证文件数。
    fetchConfig().catch(() => undefined);
    fetchModels();
    void loadAuthFiles();

    return () => {
      cancelled = true;
    };
  }, [connectionStatus, fetchConfig, fetchModels]);

  const configLoading = !config;
  const providerStats = config
    ? {
        gemini: config.geminiApiKeys?.length ?? 0,
        codex: config.codexApiKeys?.length ?? 0,
        claude: config.claudeApiKeys?.length ?? 0,
        vertex: config.vertexApiKeys?.length ?? 0,
        openai: config.openaiCompatibility?.length ?? 0,
      }
    : null;
  const totalProviderKeys = providerStats
    ? Object.values(providerStats).reduce((sum, count) => sum + count, 0)
    : 0;
  const quickStats: QuickStat[] = [
    {
      label: t('dashboard.management_keys'),
      value: config ? (config.apiKeys?.length ?? 0) : '-',
      icon: <IconKey size={24} />,
      path: '/config',
      loading: configLoading,
      sublabel: t('nav.config_management'),
    },
    {
      label: t('nav.ai_providers'),
      value: providerStats ? totalProviderKeys : '-',
      icon: <IconBot size={24} />,
      path: '/ai-providers',
      loading: configLoading,
      sublabel: providerStats
        ? t('dashboard.provider_keys_detail', {
            gemini: providerStats.gemini,
            codex: providerStats.codex,
            claude: providerStats.claude,
            vertex: providerStats.vertex,
            openai: providerStats.openai,
          })
        : undefined,
    },
    {
      label: t('nav.auth_files'),
      value: authFilesCount ?? '-',
      icon: <IconFileText size={24} />,
      path: '/auth-files',
      loading: authFilesLoading && authFilesCount === null,
      sublabel: t('dashboard.oauth_credentials'),
    },
    {
      label: t('dashboard.available_models'),
      value: modelsLoading ? '-' : models.length,
      icon: <IconSatellite size={24} />,
      path: '/system',
      loading: modelsLoading,
      sublabel: t('dashboard.available_models_desc'),
    },
  ];

  const routingStrategyRaw = config?.routingStrategy?.trim() || '';
  const routingStrategyDisplay = !routingStrategyRaw
    ? '-'
    : routingStrategyRaw === 'round-robin'
      ? t('basic_settings.routing_strategy_round_robin')
      : routingStrategyRaw === 'fill-first'
        ? t('basic_settings.routing_strategy_fill_first')
        : routingStrategyRaw;

  const formattedDate = currentTime.toLocaleDateString(i18n.language, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedTime = currentTime.toLocaleTimeString(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const serverBuildDateDisplay = formatDateValue(serverBuildDate, i18n.language);
  const connectionText = t(
    connectionStatus === 'connected'
      ? 'common.connected'
      : connectionStatus === 'connecting'
        ? 'common.connecting'
        : 'common.disconnected'
  );
  const serverVersionDisplay = serverVersion
    ? `v${serverVersion.trim().replace(/^[vV]+/, '')}`
    : '-';
  const providerHealthText = providerStats
    ? t('dashboard.provider_keys_detail', {
        gemini: providerStats.gemini,
        codex: providerStats.codex,
        claude: providerStats.claude,
        vertex: providerStats.vertex,
        openai: providerStats.openai,
      })
    : t('common.loading', { defaultValue: '加载中' });
  const railItems = [
    {
      title: t('dashboard.gateway_health', { defaultValue: 'Gateway health' }),
      badge: connectionText,
      badgeClass:
        connectionStatus === 'connected'
          ? styles.railBadgeOk
          : connectionStatus === 'connecting'
            ? styles.railBadgeWarn
            : styles.railBadgeDanger,
      description:
        connectionStatus === 'connected'
          ? t('dashboard.gateway_health_desc', {
              defaultValue: 'Management API 已连接，当前配置可以正常读取和刷新。',
            })
          : t('dashboard.gateway_health_unavailable', {
              defaultValue: '正在等待 Management API 连接，部分数据会延迟显示。',
            }),
    },
    {
      title: t('nav.ai_providers'),
      badge: `${totalProviderKeys}`,
      badgeClass: styles.railBadgeNeutral,
      description: providerHealthText,
    },
    {
      title: t('dashboard.routing_strategy', { defaultValue: '路由策略' }),
      badge: routingStrategyDisplay,
      badgeClass: routingStrategyRaw ? styles.railBadgeNeutral : styles.railBadgeWarn,
      description: t('dashboard.routing_strategy_desc', {
        defaultValue: '当前请求分发策略会影响额度消耗、冷却和失败后的切换行为。',
      }),
    },
  ];
  const systemOverviewItems = [
    {
      label: t('dashboard.system_status', { defaultValue: '系统状态' }),
      value:
        connectionStatus === 'connected'
          ? t('dashboard.system_status_ok', { defaultValue: '运行正常' })
          : connectionText,
      marker: true,
    },
    {
      label: t('dashboard.environment', { defaultValue: '环境' }),
      value: t('dashboard.production_environment', { defaultValue: '生产环境' }),
    },
    {
      label: t('dashboard.version', { defaultValue: '版本' }),
      value: serverVersionDisplay,
    },
    {
      label: t('dashboard.uptime', { defaultValue: '运行时长' }),
      value: serverBuildDateDisplay || '-',
    },
    {
      label: t('dashboard.timezone', { defaultValue: '时区' }),
      value: Intl.DateTimeFormat().resolvedOptions().timeZone || '-',
    },
  ];

  return (
    <div className={styles.dashboard}>
      <section className={styles.pageMasthead}>
        <div className={styles.mastheadCopy}>
          <span className={styles.eyebrow}>OPERATIONS CONSOLE</span>
          <h1>{t('dashboard.operations_title', { defaultValue: 'CLI Proxy 运行概览' })}</h1>
          <p>
            {t('dashboard.operations_desc', {
              defaultValue:
                '聚合访问密钥、AI 提供商、认证文件和模型状态，优先呈现每天排障最需要看的信息。',
            })}
          </p>
        </div>

        <div className={styles.timePanel}>
          <span>{formattedDate}</span>
          <strong>{formattedTime}</strong>
          <div className={styles.connectionPill}>
            <span
              className={`${styles.statusDot} ${
                connectionStatus === 'connected'
                  ? styles.connected
                  : connectionStatus === 'connecting'
                    ? styles.connecting
                    : styles.disconnected
              }`}
            />
            <span>{connectionText}</span>
          </div>
        </div>
      </section>

      <section className={styles.dashboardGrid}>
        <main className={styles.mainColumn}>
          <div className={styles.summaryGrid}>
            {quickStats.map((stat) => (
              <Link key={stat.path} to={stat.path} className={styles.summaryCard}>
                <span className={styles.summaryIcon}>{stat.icon}</span>
                <span className={styles.summaryLabel}>{stat.label}</span>
                <strong>{stat.loading ? '...' : stat.value}</strong>
                {stat.sublabel ? <small>{stat.sublabel}</small> : null}
              </Link>
            ))}
          </div>

          <div className={styles.workbenchGrid}>
            <Link to="/monitoring" className={`${styles.panelCard} ${styles.recentPanel}`}>
              <div className={styles.panelHeader}>
                <h2>{t('dashboard.recent_requests', { defaultValue: '最近请求' })}</h2>
                <span className={styles.iconButton} aria-hidden="true">
                  <IconFileText size={16} />
                </span>
              </div>
              <div className={styles.emptyState}>
                <IconInbox size={52} />
                <strong>
                  {t('dashboard.no_recent_requests', { defaultValue: '暂无请求记录' })}
                </strong>
                <span>
                  {t('dashboard.no_recent_requests_desc', {
                    defaultValue: '请求将在此自动显示',
                  })}
                </span>
              </div>
            </Link>

            <Link to="/usage-analytics" className={`${styles.panelCard} ${styles.usagePanel}`}>
              <div className={styles.panelHeader}>
                <h2>{t('dashboard.usage_trend', { defaultValue: '用量趋势' })}</h2>
                <span className={styles.periodBadge}>
                  7 天
                  <IconChevronDown size={14} />
                </span>
              </div>
              <div className={styles.trendTotal}>
                <strong>0</strong>
                <span>{t('dashboard.total_requests', { defaultValue: '总请求数' })}</span>
              </div>
              <div className={styles.miniChart} aria-hidden="true">
                {['6/20', '6/21', '6/22', '6/23', '6/24', '6/25', '6/26'].map((day) => (
                  <span key={day} data-day={day} />
                ))}
              </div>
            </Link>

            <article className={`${styles.panelCard} ${styles.routingPanel}`}>
              <div className={styles.panelHeader}>
                <h2>{t('dashboard.routing_strategy', { defaultValue: '路由策略' })}</h2>
                <span className={styles.iconButton} aria-hidden="true">
                  <IconRefreshCw size={15} />
                </span>
              </div>
              <strong className={styles.strategyValue}>{routingStrategyDisplay}</strong>
              <p>
                {t('dashboard.routing_strategy_desc', {
                  defaultValue: '当前请求分发策略会影响额度消耗、冷却和失败后的切换行为。',
                })}
              </p>
            </article>
          </div>

          <section className={styles.systemOverview}>
            <div className={styles.systemHeader}>
              <h2>{t('dashboard.system_overview')}</h2>
              <Link
                to="/system"
                className={styles.systemLink}
                aria-label={t('dashboard.system_overview')}
              >
                <IconChevronLeft size={16} />
              </Link>
            </div>
            <div className={styles.systemMetrics}>
              {systemOverviewItems.map((item) => (
                <div className={styles.systemMetric} key={item.label}>
                  <span>{item.label}</span>
                  <strong>
                    {item.marker ? <i className={styles.metricDot} aria-hidden="true" /> : null}
                    {item.value}
                  </strong>
                </div>
              ))}
            </div>
          </section>
        </main>

        <aside className={styles.rightRail}>
          {railItems.map((item) => (
            <article className={styles.railPanel} key={item.title}>
              <div className={styles.railPanelTop}>
                <h2>{item.title}</h2>
                <span className={`${styles.railBadge} ${item.badgeClass}`}>{item.badge}</span>
              </div>
              <p>{item.description}</p>
            </article>
          ))}

          <article className={styles.railPanel}>
            <div className={styles.railPanelTop}>
              <h2>{t('dashboard.build_info', { defaultValue: '构建信息' })}</h2>
              <span className={styles.infoChip} aria-hidden="true">
                <IconInfo size={15} />
              </span>
            </div>
            <p>
              {t('dashboard.build_info_desc', {
                defaultValue: '确认线上版本和构建时间，便于排查部署后行为差异。',
              })}
            </p>
          </article>
        </aside>
      </section>
    </div>
  );
}
