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
});
