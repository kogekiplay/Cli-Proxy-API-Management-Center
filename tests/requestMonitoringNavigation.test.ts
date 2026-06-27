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
});
