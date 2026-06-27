import { useCallback, useEffect, useMemo, useState } from 'react';
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
  IconShield,
  IconModelCluster,
  IconTimer,
  IconNetwork,
  IconCode,
} from '@/components/ui/icons';
import { useAuthStore, useConfigStore, useModelsStore } from '@/stores';
import {
  buildDashboardDailyTrend,
  buildDashboardUsageRequest,
  summarizeDashboardUsage,
} from '@/features/dashboard/dashboardUsage';
import { authFilesApi } from '@/services/api';
import { configApi } from '@/services/api/config';
import { usageAnalyticsApi, type UsageAnalyticsResponse } from '@/services/api/usageAnalytics';
import { useApiKeysForModels } from '@/hooks/useApiKeysForModels';
import { formatDateValue } from '@/utils/format';
import { getErrorMessage } from '@/utils/helpers';
import styles from './DashboardPage.module.scss';

interface QuickStat {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  path: string;
  loading?: boolean;
  sublabel?: string;
}

const dashboardNumberFormatter = new Intl.NumberFormat();

const formatDashboardNumber = (value: number | undefined | null) =>
  dashboardNumberFormatter.format(value ?? 0);

const formatDashboardEventTime = (value: number | undefined | null, language: string) => {
  if (!value) return '-';
  const date = new Date(value);
  const day = date.toLocaleDateString(language, {
    month: '2-digit',
    day: '2-digit',
  });
  const time = date.toLocaleTimeString(language, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${day}\n${time}`;
};

const statusCodeOf = (row: { status_code?: number; fail_status_code?: number; failed?: boolean }) =>
  row.status_code || row.fail_status_code || (row.failed ? 500 : 200);

const CHART_WIDTH = 300;
const CHART_HEIGHT = 118;
const CHART_BASELINE = 96;
const CHART_TOP = 12;
const CHART_LEFT = 14;
const CHART_RIGHT = 14;

const buildChartLinePath = (points: Array<{ x: number; y: number }>) =>
  points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

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
  const [dashboardUsageData, setDashboardUsageData] = useState<UsageAnalyticsResponse | null>(null);
  const [dashboardUsageLoading, setDashboardUsageLoading] = useState(false);
  const [dashboardUsageError, setDashboardUsageError] = useState('');
  const [dashboardUsageRefreshToken, setDashboardUsageRefreshToken] = useState(0);
  const [routingStrategy, setRoutingStrategy] = useState('');
  const [routingStrategyRefreshToken, setRoutingStrategyRefreshToken] = useState(0);

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

  const refreshDashboardUsage = useCallback(() => {
    setDashboardUsageRefreshToken((token) => token + 1);
  }, []);

  const refreshRoutingStrategy = useCallback(() => {
    setRoutingStrategyRefreshToken((token) => token + 1);
  }, []);

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

  useEffect(() => {
    if (connectionStatus !== 'connected') {
      setDashboardUsageData(null);
      setDashboardUsageError('');
      return;
    }

    let cancelled = false;
    setDashboardUsageLoading(true);
    setDashboardUsageError('');

    usageAnalyticsApi
      .query(buildDashboardUsageRequest())
      .then((response) => {
        if (!cancelled) setDashboardUsageData(response);
      })
      .catch((error) => {
        if (!cancelled) {
          setDashboardUsageData(null);
          setDashboardUsageError(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (!cancelled) setDashboardUsageLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [connectionStatus, dashboardUsageRefreshToken]);

  useEffect(() => {
    if (connectionStatus !== 'connected') {
      setRoutingStrategy('');
      return;
    }

    let cancelled = false;

    configApi
      .getRoutingStrategy()
      .then((strategy) => {
        if (!cancelled) setRoutingStrategy(strategy);
      })
      .catch(() => {
        if (!cancelled) setRoutingStrategy('');
      });

    return () => {
      cancelled = true;
    };
  }, [connectionStatus, routingStrategyRefreshToken]);

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

  const routingStrategyRaw = (routingStrategy || config?.routingStrategy || 'round-robin').trim();
  const routingStrategyDisplay =
    routingStrategyRaw === 'fill-first'
      ? t('basic_settings.routing_strategy_fill_first')
      : routingStrategyRaw === 'round-robin'
        ? t('basic_settings.routing_strategy_round_robin')
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
  const managementCenterVersionDisplay = __APP_VERSION__ || '-';
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
  ];
  const systemOverviewItems = [
    {
      label: t('dashboard.system_status', { defaultValue: '系统状态' }),
      value:
        connectionStatus === 'connected'
          ? t('dashboard.system_status_ok', { defaultValue: '运行正常' })
          : connectionText,
      marker: true,
      icon: <IconShield size={15} />,
    },
    {
      label: t('footer.version', { defaultValue: '管理中心版本' }),
      value: managementCenterVersionDisplay,
      icon: <IconCode size={15} />,
    },
    {
      label: t('footer.api_version', { defaultValue: 'CPA 版本' }),
      value: serverVersionDisplay,
      icon: <IconModelCluster size={15} />,
    },
    {
      label: t('dashboard.build_time', { defaultValue: '构建时间' }),
      value: serverBuildDateDisplay || '-',
      icon: <IconTimer size={15} />,
    },
    {
      label: t('dashboard.timezone', { defaultValue: '时区' }),
      value: Intl.DateTimeFormat().resolvedOptions().timeZone || '-',
      icon: <IconNetwork size={15} />,
    },
  ];
  const dashboardUsage = useMemo(
    () => summarizeDashboardUsage(dashboardUsageData),
    [dashboardUsageData]
  );
  const usageTimeline = useMemo(
    () => buildDashboardDailyTrend(dashboardUsage.timeline, currentTime.getTime()),
    [dashboardUsage.timeline, currentTime]
  );
  const usageTimelineMaxCalls = Math.max(...usageTimeline.map((point) => point.calls), 1);
  const chartPoints = useMemo(() => {
    const plotWidth = CHART_WIDTH - CHART_LEFT - CHART_RIGHT;
    const plotHeight = CHART_BASELINE - CHART_TOP;
    const divisor = Math.max(usageTimeline.length - 1, 1);

    return usageTimeline.map((point, index) => ({
      x: CHART_LEFT + (plotWidth * index) / divisor,
      y: CHART_BASELINE - ((point.calls || 0) / usageTimelineMaxCalls) * plotHeight,
    }));
  }, [usageTimeline, usageTimelineMaxCalls]);
  const chartLinePath = buildChartLinePath(chartPoints);
  const lastChartPoint = chartPoints[chartPoints.length - 1];
  const chartAreaPath =
    chartPoints.length > 0
      ? `${chartLinePath} L ${lastChartPoint.x} ${CHART_BASELINE} L ${
          chartPoints[0].x
        } ${CHART_BASELINE} Z`
      : '';
  const recentEvents = dashboardUsage.events.slice(0, 5);

  return (
    <div className={styles.dashboard}>
      <section className={styles.dashboardShell}>
        <main className={styles.mainColumn}>
          <section className={styles.pageMasthead}>
            <span className={styles.eyebrow}>OPERATIONS CONSOLE</span>
            <h1>{t('dashboard.operations_title', { defaultValue: 'CLI Proxy 运行概览' })}</h1>
            <p>
              {t('dashboard.operations_desc', {
                defaultValue:
                  '聚合访问密钥、AI 提供商、认证文件和模型状态，优先呈现每天排障最需要看的信息。',
              })}
            </p>
          </section>

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
            <article className={`${styles.panelCard} ${styles.recentPanel}`}>
              <div className={styles.panelHeader}>
                <h2>{t('dashboard.recent_requests', { defaultValue: '最近请求' })}</h2>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={refreshDashboardUsage}
                  aria-label={t('dashboard.refresh_recent_requests', {
                    defaultValue: '刷新最近请求',
                  })}
                  title={t('dashboard.refresh_recent_requests', {
                    defaultValue: '刷新最近请求',
                  })}
                >
                  <IconFileText size={16} />
                </button>
              </div>
              {dashboardUsageLoading ? (
                <div className={styles.emptyState}>
                  <IconInbox size={46} />
                  <strong>{t('common.loading', { defaultValue: '加载中' })}</strong>
                  <span>
                    {t('dashboard.loading_recent_requests', { defaultValue: '正在读取最近请求' })}
                  </span>
                </div>
              ) : recentEvents.length > 0 ? (
                <div className={styles.recentRequestList}>
                  {recentEvents.map((row) => {
                    const statusCode = statusCodeOf(row);
                    return (
                      <div className={styles.recentRequestRow} key={row.id || row.request_id}>
                        <span className={styles.recentRequestTime}>
                          {formatDashboardEventTime(row.timestamp_ms, i18n.language)}
                        </span>
                        <span className={styles.recentRequestMain}>
                          <strong>{row.model || '-'}</strong>
                          <small>
                            {[row.provider || 'unknown', row.endpoint || '-'].join(' · ')}
                          </small>
                        </span>
                        <span
                          className={[
                            styles.recentStatus,
                            row.failed || statusCode >= 500
                              ? styles.recentStatusBad
                              : statusCode >= 400
                                ? styles.recentStatusWarn
                                : styles.recentStatusGood,
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          {statusCode}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <IconInbox size={52} />
                  <strong>
                    {dashboardUsageError ||
                      t('dashboard.no_recent_requests', { defaultValue: '暂无请求记录' })}
                  </strong>
                  <span>
                    {dashboardUsageError
                      ? t('dashboard.usage_load_failed', { defaultValue: '用量数据读取失败' })
                      : t('dashboard.no_recent_requests_desc', {
                          defaultValue: '请求将在此自动显示',
                        })}
                  </span>
                </div>
              )}
              <Link to="/monitoring" className={styles.panelAction}>
                {t('dashboard.view_all_requests', { defaultValue: '查看全部请求' })}
                <IconChevronLeft size={15} />
              </Link>
            </article>

            <article className={`${styles.panelCard} ${styles.usagePanel}`}>
              <div className={styles.panelHeader}>
                <h2>{t('dashboard.usage_trend', { defaultValue: '用量趋势' })}</h2>
                <button
                  type="button"
                  className={styles.periodBadge}
                  onClick={refreshDashboardUsage}
                  aria-label={t('dashboard.refresh_usage_trend', {
                    defaultValue: '刷新 7 天用量趋势',
                  })}
                  title={t('dashboard.refresh_usage_trend', {
                    defaultValue: '刷新 7 天用量趋势',
                  })}
                >
                  7 天
                  <IconChevronDown size={14} />
                </button>
              </div>
              <div className={styles.trendTotal}>
                <strong>
                  {dashboardUsageLoading ? '...' : formatDashboardNumber(dashboardUsage.totalCalls)}
                </strong>
                <span>{t('dashboard.total_requests', { defaultValue: '总请求数' })}</span>
              </div>
              <div className={styles.chartFrame} aria-hidden="true">
                <svg
                  className={styles.chartSvg}
                  viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                  preserveAspectRatio="none"
                >
                  <line className={styles.chartGridLine} x1="0" x2={CHART_WIDTH} y1="28" y2="28" />
                  <line className={styles.chartGridLine} x1="0" x2={CHART_WIDTH} y1="62" y2="62" />
                  <line
                    className={styles.chartGridLine}
                    x1="0"
                    x2={CHART_WIDTH}
                    y1={CHART_BASELINE}
                    y2={CHART_BASELINE}
                  />
                  {chartAreaPath ? <path className={styles.chartArea} d={chartAreaPath} /> : null}
                  {chartLinePath ? <path className={styles.chartLine} d={chartLinePath} /> : null}
                  {chartPoints.map((point, index) => (
                    <circle
                      className={styles.chartDot}
                      cx={point.x}
                      cy={point.y}
                      key={`${usageTimeline[index]?.dayStartMs ?? index}-${point.x}`}
                      r="3.7"
                    />
                  ))}
                </svg>
                <div className={styles.chartLabels}>
                  {usageTimeline.map((point) => (
                    <span key={point.dayStartMs}>{point.label}</span>
                  ))}
                </div>
              </div>
              <Link to="/usage-analytics" className={styles.panelAction}>
                {t('dashboard.view_usage_analytics', { defaultValue: '查看用量分析' })}
                <IconChevronLeft size={15} />
              </Link>
            </article>

            <article className={`${styles.panelCard} ${styles.routingPanel}`}>
              <div className={styles.panelHeader}>
                <h2>{t('dashboard.routing_strategy', { defaultValue: '路由策略' })}</h2>
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={refreshRoutingStrategy}
                  aria-label={t('dashboard.refresh_routing_strategy', {
                    defaultValue: '刷新路由策略',
                  })}
                  title={t('dashboard.refresh_routing_strategy', {
                    defaultValue: '刷新路由策略',
                  })}
                >
                  <IconRefreshCw size={15} />
                </button>
              </div>
              <strong className={styles.strategyValue}>
                <IconNetwork size={15} />
                {routingStrategyDisplay}
              </strong>
              <p>
                {t('dashboard.routing_strategy_desc', {
                  defaultValue: '当前请求分发策略会影响额度消耗、冷却和失败后的切换行为。',
                })}
              </p>
              <ul className={styles.routeDetails}>
                <li>
                  {t('dashboard.routing_order_hint', {
                    defaultValue: '按顺序将请求依次分配到可用模型。',
                  })}
                </li>
                <li>
                  {t('dashboard.routing_skip_hint', {
                    defaultValue: '自动跳过不可用节点，保障稳定性。',
                  })}
                </li>
                <li>
                  {t('dashboard.routing_quota_hint', {
                    defaultValue: '适用于负载均衡与高可用场景。',
                  })}
                </li>
              </ul>
              <Link to="/config" className={styles.panelAction}>
                {t('dashboard.manage_routing_strategy', { defaultValue: '管理路由策略' })}
                <IconChevronLeft size={15} />
              </Link>
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
                  <span className={styles.systemMetricLabel}>
                    <i aria-hidden="true">{item.icon}</i>
                    {item.label}
                  </span>
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
          <article className={styles.timePanel}>
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
          </article>

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
