import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IconKey,
  IconBot,
  IconFileText,
  IconSatellite,
  IconInbox,
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
  DASHBOARD_USAGE_RANGE_OPTIONS,
  buildDashboardRecentEventsRequest,
  buildDashboardRangeTrend,
  buildDashboardTrendRequest,
  getDashboardUsageRangeOption,
  summarizeDashboardUsage,
  type DashboardUsageRange,
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
  const [dashboardTrendData, setDashboardTrendData] = useState<UsageAnalyticsResponse | null>(null);
  const [dashboardTrendLoading, setDashboardTrendLoading] = useState(false);
  const [dashboardTrendError, setDashboardTrendError] = useState('');
  const [dashboardRecentData, setDashboardRecentData] = useState<UsageAnalyticsResponse | null>(
    null
  );
  const [dashboardRecentLoading, setDashboardRecentLoading] = useState(false);
  const [dashboardRecentError, setDashboardRecentError] = useState('');
  const [dashboardUsageRange, setDashboardUsageRange] = useState<DashboardUsageRange>('7d');
  const [dashboardRecentRefreshToken, setDashboardRecentRefreshToken] = useState(0);
  const [usageRangeMenuOpen, setUsageRangeMenuOpen] = useState(false);
  const [routingStrategy, setRoutingStrategy] = useState('');

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

  const refreshDashboardRecentRequests = useCallback(() => {
    setDashboardRecentRefreshToken((token) => token + 1);
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
      setDashboardTrendData(null);
      setDashboardTrendError('');
      return;
    }

    let cancelled = false;
    setDashboardTrendLoading(true);
    setDashboardTrendError('');

    usageAnalyticsApi
      .query(buildDashboardTrendRequest(Date.now(), dashboardUsageRange))
      .then((response) => {
        if (!cancelled) setDashboardTrendData(response);
      })
      .catch((error) => {
        if (!cancelled) {
          setDashboardTrendData(null);
          setDashboardTrendError(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (!cancelled) setDashboardTrendLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [connectionStatus, dashboardUsageRange]);

  useEffect(() => {
    if (connectionStatus !== 'connected') {
      setDashboardRecentData(null);
      setDashboardRecentError('');
      return;
    }

    let cancelled = false;
    setDashboardRecentLoading(true);
    setDashboardRecentError('');

    usageAnalyticsApi
      .query(buildDashboardRecentEventsRequest(Date.now()))
      .then((response) => {
        if (!cancelled) setDashboardRecentData(response);
      })
      .catch((error) => {
        if (!cancelled) {
          setDashboardRecentData(null);
          setDashboardRecentError(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (!cancelled) setDashboardRecentLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [connectionStatus, dashboardRecentRefreshToken]);

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
  }, [connectionStatus]);

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

  const currentTimeDisplay = currentTime.toLocaleString(i18n.language, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
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
    {
      label: t('dashboard.current_time', { defaultValue: '当前时间' }),
      value: currentTimeDisplay,
      icon: <IconTimer size={15} />,
    },
  ];
  const dashboardUsage = useMemo(
    () => summarizeDashboardUsage(dashboardTrendData),
    [dashboardTrendData]
  );
  const dashboardRecentUsage = useMemo(
    () => summarizeDashboardUsage(dashboardRecentData),
    [dashboardRecentData]
  );
  const usageTimeline = useMemo(
    () =>
      buildDashboardRangeTrend(dashboardUsage.timeline, currentTime.getTime(), dashboardUsageRange),
    [dashboardUsage.timeline, currentTime, dashboardUsageRange]
  );
  const visibleUsageTimelineLabels = useMemo(
    () => usageTimeline.filter((point) => point.label.trim()),
    [usageTimeline]
  );
  const selectedUsageRangeOption = getDashboardUsageRangeOption(dashboardUsageRange);
  const selectedUsageRangeLabel = t(selectedUsageRangeOption.labelKey, {
    defaultValue: selectedUsageRangeOption.defaultLabel,
  });
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
  const recentEvents = dashboardRecentUsage.events.slice(0, 5);
  const handleDashboardUsageRangeChange = useCallback((nextRange: DashboardUsageRange) => {
    setDashboardUsageRange(nextRange);
    setUsageRangeMenuOpen(false);
  }, []);

  return (
    <div className={styles.dashboard}>
      <section className={styles.dashboardShell}>
        <section className={styles.pageMasthead}>
          <span className={styles.eyebrow}>
            {t('dashboard.operations_console', { defaultValue: '运行控制台' })}
          </span>
          <h1>{t('dashboard.operations_title', { defaultValue: 'CLI Proxy 运行概览' })}</h1>
          <p>
            {t('dashboard.operations_desc', {
              defaultValue:
                '聚合访问密钥、AI 提供商、认证文件和模型状态，优先呈现每天排障最需要看的信息。',
            })}
          </p>
        </section>

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
            <article className={`${styles.panelCard} ${styles.recentPanel}`}>
              <div className={styles.panelHeader}>
                <h2>{t('dashboard.recent_requests', { defaultValue: '最近请求' })}</h2>
                <button
                  type="button"
                  className={`${styles.iconButton} ${
                    dashboardRecentLoading ? styles.loadingIconButton : ''
                  }`}
                  onClick={refreshDashboardRecentRequests}
                  disabled={dashboardRecentLoading}
                  aria-label={t('dashboard.refresh_recent_requests', {
                    defaultValue: '刷新最近请求',
                  })}
                  title={t('dashboard.refresh_recent_requests', {
                    defaultValue: '刷新最近请求',
                  })}
                >
                  <IconRefreshCw size={15} />
                </button>
              </div>
              {dashboardRecentLoading ? (
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
                    {dashboardRecentError ||
                      t('dashboard.no_recent_requests', { defaultValue: '暂无请求记录' })}
                  </strong>
                  <span>
                    {dashboardRecentError
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
                <div
                  className={styles.periodSelector}
                  onBlur={(event) => {
                    const nextTarget = event.relatedTarget;
                    if (
                      !(nextTarget instanceof Node) ||
                      !event.currentTarget.contains(nextTarget)
                    ) {
                      setUsageRangeMenuOpen(false);
                    }
                  }}
                >
                  <button
                    type="button"
                    className={styles.periodBadge}
                    onClick={() => setUsageRangeMenuOpen((open) => !open)}
                    aria-haspopup="menu"
                    aria-expanded={usageRangeMenuOpen}
                    aria-label={t('dashboard.select_usage_range', {
                      defaultValue: '选择用量趋势范围',
                    })}
                  >
                    {selectedUsageRangeLabel}
                    <IconChevronDown
                      size={14}
                      className={usageRangeMenuOpen ? styles.periodChevronOpen : ''}
                    />
                  </button>
                  {usageRangeMenuOpen ? (
                    <div className={styles.periodMenu} role="menu">
                      {DASHBOARD_USAGE_RANGE_OPTIONS.map((option) => {
                        const active = option.value === dashboardUsageRange;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="menuitemradio"
                            aria-checked={active}
                            className={`${styles.periodMenuItem} ${
                              active ? styles.periodMenuItemActive : ''
                            }`}
                            onClick={() => handleDashboardUsageRangeChange(option.value)}
                          >
                            {t(option.labelKey, { defaultValue: option.defaultLabel })}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className={styles.trendTotal}>
                <strong>
                  {dashboardTrendLoading
                    ? '...'
                    : dashboardTrendError
                      ? '-'
                      : formatDashboardNumber(dashboardUsage.totalCalls)}
                </strong>
                <span>
                  {dashboardTrendError ||
                    t('dashboard.total_requests', { defaultValue: '总请求数' })}
                </span>
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
                  {visibleUsageTimelineLabels.map((point) => (
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
      </section>
    </div>
  );
}
