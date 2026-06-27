import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Claude-style visual direction adoption', () => {
  test('uses the clay accent and operations-console dashboard primitives', () => {
    const variables = read('src/styles/variables.scss');
    const dashboard = read('src/pages/DashboardPage.tsx');
    const dashboardStyles = read('src/pages/DashboardPage.module.scss');

    expect(variables).toContain('$primary-color: #c96442;');
    expect(dashboard).toContain('pageMasthead');
    expect(dashboard).toContain('dashboardShell');
    expect(dashboard).toContain('rightRail');
    expect(dashboard).toContain('chartSvg');
    expect(dashboard).toContain('panelAction');
    expect(dashboard).toContain('routeDetails');
    expect(dashboardStyles).toContain('.pageMasthead');
    expect(dashboardStyles).toContain('.dashboardShell');
    expect(dashboardStyles).toContain('.rightRail');
    expect(dashboardStyles).toContain('.summaryCard');
    expect(dashboardStyles).toContain('.chartSvg');
    expect(dashboardStyles).toContain('.panelAction');
    expect(dashboardStyles).toContain('.routeDetails');
    expect(dashboardStyles).not.toContain('.dashboardGrid');
    expect(dashboardStyles).not.toContain('.backgroundOrbs');
    expect(dashboardStyles).not.toContain('.opsHero');
  });

  test('keeps usage pages in a dense operations toolbar style', () => {
    const usageStyles = read('src/pages/UsageAnalyticsPage.module.scss');

    expect(usageStyles).toContain('.operationsToolbar');
    expect(usageStyles).toContain('.metricCard::before');
    expect(usageStyles).toContain('background: var(--ops-panel-bg)');
  });

  test('keeps dashboard overview labels useful and avoids duplicated routing rail cards', () => {
    const dashboard = read('src/pages/DashboardPage.tsx');

    expect(dashboard).toContain("t('footer.version'");
    expect(dashboard).toContain("t('footer.api_version'");
    expect(dashboard).not.toContain("defaultValue: '生产环境'");
    expect(dashboard).not.toContain('badgeClass: routingStrategyRaw');
  });

  test('keeps the dashboard right rail focused on connection health only', () => {
    const dashboard = read('src/pages/DashboardPage.tsx');
    const styles = read('src/pages/DashboardPage.module.scss');

    expect(dashboard).toContain("t('dashboard.gateway_health'");
    expect(dashboard).not.toContain('providerHealthText');
    expect(dashboard).not.toContain("title: t('nav.ai_providers')");
    expect(dashboard).not.toContain("t('dashboard.build_info'");
    expect(styles).toContain('padding-top: 146px;');
  });
});
