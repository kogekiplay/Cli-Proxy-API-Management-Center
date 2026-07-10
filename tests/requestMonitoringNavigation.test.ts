import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('request monitoring navigation', () => {
  test('exposes request monitoring as a separate page from usage analytics', () => {
    const routes = read('src/router/MainRoutes.tsx');
    const layout = read('src/components/layout/MainLayout.tsx');
    const page = read('src/pages/RequestMonitoringPage.tsx');
    const zhCN = read('src/i18n/locales/zh-CN.json');

    expect(routes).toContain('/usage-analytics');
    expect(routes).toContain('/monitoring');
    expect(routes).toContain('RequestMonitoringPage');

    expect(layout).toContain("path: '/monitoring'");
    expect(layout).toContain("labelKey: 'nav.request_monitoring'");
    expect(layout).toContain("metaKey: 'nav_meta.request_monitoring'");

    expect(page).toContain('view="monitoring"');
    expect(zhCN).toContain('"request_monitoring": "请求监控"');
    expect(zhCN).toContain('"title": "请求监控"');
  });

  test('renders request monitoring with a dedicated console layout', () => {
    const page = read('src/pages/UsageAnalyticsPage.tsx');
    const styles = read('src/pages/UsageAnalyticsPage.module.scss');

    expect(page).toContain('renderMonitoringKpiCards');
    expect(page).toContain('renderMonitoringFilters');
    expect(page).toContain('renderMonitoringTable');
    expect(page).toContain('monitoringStatusFilter');
    expect(page).toContain('monitoringSearch');
    expect(page).toContain('monitoringPageSize');
    expect(page).toContain('monitoringRows');
    expect(page).toContain('总请求数');
    expect(page).toContain('P50 延迟');

    expect(styles).toContain('.monitoringKpiGrid');
    expect(styles).toContain('.monitoringToolbar');
    expect(styles).toContain('.monitoringSearch');
    expect(styles).toContain('.monitoringTableCard');
    expect(styles).toContain('.monitoringPagination');
    expect(styles).toContain('min-width: 1320px;');
    expect(styles).toContain('padding: 13px 12px;');
    expect(styles).toContain('.monitoringModelCell');
    expect(styles).toContain('.monitoringProviderCell {\n  align-items: center;');
  });

  test('uses the status tooltip without rendering an error column', () => {
    const page = read('src/pages/UsageAnalyticsPage.tsx');
    const styles = read('src/pages/UsageAnalyticsPage.module.scss');
    const statusBadge = read('src/features/usageAnalytics/UsageStatusBadge.tsx');
    const statusBadgeStyles = read('src/features/usageAnalytics/UsageStatusBadge.module.scss');

    expect(page).toContain("import { UsageStatusBadge } from '@/features/usageAnalytics/UsageStatusBadge';");
    expect(page).toContain('<UsageStatusBadge row={row} />');
    expect(page).not.toContain('<th>{t(\'usage_analytics.error_message\')}</th>');
    expect(page).not.toContain('monitoringErrorCell');
    expect(styles).not.toContain('.monitoringErrorCell');
    expect(statusBadge).toContain('const hasError = row.failed && Boolean(error.summary || error.title || error.detail);');
    expect(statusBadge).toContain('tabIndex={hasError ? 0 : undefined}');
    expect(statusBadge).toContain('aria-describedby={hasError ? tooltipId : undefined}');
    expect(statusBadge).toContain("from './usageStatusBadgeTooltip';");
    expect(statusBadge).toContain('isUsageStatusTooltipVisible({ hovered, focused })');
    expect(statusBadge).toContain('onPointerEnter={() => setHovered(true)}');
    expect(statusBadge).toContain('onPointerLeave={() => setHovered(false)}');
    expect(statusBadge).toContain('onFocus={() => setFocused(true)}');
    expect(statusBadge).toContain('onBlur={() => setFocused(false)}');
    expect(statusBadge).toContain('isUsageStatusBadgeActivationKey(event.key)');
    expect(statusBadge).toContain('event.stopPropagation()');
    expect(statusBadge).toContain('role="tooltip"');
    expect(statusBadge).toContain('createPortal(');
    expect(statusBadge).toContain("window.addEventListener('scroll', updatePosition, true);");
    expect(statusBadgeStyles).toContain('position: fixed;');
    expect(statusBadgeStyles).toContain('z-index: 2001;');
    expect(statusBadgeStyles).toContain('max-width: min(360px, calc(100vw - 24px));');
    expect(statusBadgeStyles).toContain('max-height: 240px;');
    expect(statusBadgeStyles).toContain('width: 56px;');
    expect(statusBadgeStyles).toContain('min-width: 56px;');
    expect(styles).toContain('align-content: center;');
  });

  test('keeps provider, model, and status as independent compact columns', () => {
    const page = read('src/pages/UsageAnalyticsPage.tsx');
    const locales = ['en', 'ru', 'zh-CN', 'zh-TW'].map((locale) => [
      locale,
      JSON.parse(read(`src/i18n/locales/${locale}.json`)) as {
        usage_analytics: Record<string, string>;
      },
    ] as const);
    const zhCN = locales.find(([locale]) => locale === 'zh-CN')![1];

    expect(page).toContain("<th>{t('usage_analytics.provider')}</th>");
    expect(page).toContain("<th>{t('usage_analytics.model')}</th>");
    expect(page).not.toContain("<th>{t('usage_analytics.error_message')}</th>");
    expect(page).not.toContain('<th>提供商 / 模型</th>');
    expect(page).toContain('className={styles.monitoringModelCell}');
    expect(page).toContain('row.upstream_model && row.upstream_model !== row.model');
    expect(page).toContain('`${row.model} · 上游 ${row.upstream_model}`');
    expect(zhCN.usage_analytics.provider).toBe('提供商');
  });

  test('contains long monitoring headers and cost values within their columns', () => {
    const styles = read('src/pages/UsageAnalyticsPage.module.scss');

    expect(styles).toContain(`  th {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;`);
    expect(styles).toContain(`.monitoringCostCell {
  min-width: 0;

  strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;`);
  });

  test('provides a working date picker without squeezing the range tabs', () => {
    const page = read('src/pages/UsageAnalyticsPage.tsx');
    const styles = read('src/pages/UsageAnalyticsPage.module.scss');

    expect(page).toContain('IconCalendar');
    expect(page).toContain('dateFilter');
    expect(page).toContain('resolveAnalyticsToMs(dateFilter)');
    expect(page).toContain('type="date"');
    expect(page).toContain('handleDateFilterChange');
    expect(page).toContain('aria-label="选择日期"');
    expect(styles).toContain('minmax(250px, 0.95fr)');
    expect(styles).toContain('.monitoringDatePicker');
  });

  test('keeps latency and TTFT as one centered monitoring table line', () => {
    const page = read('src/pages/UsageAnalyticsPage.tsx');
    const styles = read('src/pages/UsageAnalyticsPage.module.scss');

    expect(page).not.toContain('<small>延迟 / TTFT</small>');
    expect(styles).toContain('justify-items: center;');
    expect(styles).toContain('align-content: center;');
    expect(styles).toContain('white-space: nowrap;');
  });

  test('uses compact provider labels in the monitoring table only', () => {
    const page = read('src/pages/UsageAnalyticsPage.tsx');

    expect(page).toContain('monitoringProviderLabel,');
    expect(page).toContain("from './usageMonitoringColumns';");
    expect(page).toContain('{monitoringProviderLabel(row.provider)}');
    expect(page).toContain('title={row.provider}');
    expect(page).toContain("value={selectedEvent.provider || '-'}");
  });

  test('shows the upstream model in the detail drawer only when it differs from the alias', () => {
    const page = read('src/pages/UsageAnalyticsPage.tsx');

    expect(page).toContain('selectedEvent.upstream_model !== selectedEvent.model');
    expect(page).toContain('label="上游模型"');
  });

  test('aligns status badges with a stable reasoning effort column', () => {
    const page = read('src/pages/UsageAnalyticsPage.tsx');
    const styles = read('src/pages/UsageAnalyticsPage.module.scss');

    expect(page).toContain('MONITORING_COLUMN_WIDTHS');
    expect(page).toContain('<colgroup>');
    expect(page).toContain('formatReasoningEffort(row.reasoning_effort)');
    expect(page).toContain("t('usage_analytics.reasoning_effort')");
    expect(styles).toContain('.reasoningEffortBadge');
    expect(styles).not.toContain('max-width: 180px;');
    expect(styles).toContain('width: 100%;');
  });
});
