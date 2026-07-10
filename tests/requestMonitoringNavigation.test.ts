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
  });

  test('keeps successful status cells compact without empty error rows', () => {
    const page = read('src/pages/UsageAnalyticsPage.tsx');
    const styles = read('src/pages/UsageAnalyticsPage.module.scss');

    expect(page).toContain('if (!row.failed && !error.summary) return null;');
    expect(page).not.toContain('<span className={styles.mutedDash}>-</span>');
    expect(styles).toContain('width: 56px;');
    expect(styles).toContain('min-width: 56px;');
    expect(styles).toContain('justify-self: center;');
    expect(styles).toContain('align-content: center;');
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

    expect(page).toContain('const monitoringProviderLabel');
    expect(page).toContain(
      "if (provider === 'openai-compatible-opencode-go') return 'opencode-go';"
    );
    expect(page).toContain('{monitoringProviderLabel(row.provider)}');
    expect(page).toContain('value={providerLabel(selectedEvent.provider)}');
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
