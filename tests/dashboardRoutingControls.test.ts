import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('dashboard routing controls', () => {
  test('reads routing strategy from the dedicated management endpoint with a real default', () => {
    const dashboard = read('src/pages/DashboardPage.tsx');

    expect(dashboard).toContain("import { configApi } from '@/services/api/config';");
    expect(dashboard).toContain('configApi');
    expect(dashboard).toContain('getRoutingStrategy()');
    expect(dashboard).toContain("|| 'round-robin'");
    expect(dashboard).not.toContain("!routingStrategyRaw\n    ? '-'");
  });

  test('keeps dashboard panel controls clickable by limiting navigation to explicit actions', () => {
    const dashboard = read('src/pages/DashboardPage.tsx');

    expect(dashboard).toContain('className={`${styles.panelCard} ${styles.recentPanel}`}');
    expect(dashboard).toContain('className={`${styles.panelCard} ${styles.usagePanel}`}');
    expect(dashboard).not.toContain(
      '<Link to="/monitoring" className={`${styles.panelCard} ${styles.recentPanel}`}>'
    );
    expect(dashboard).not.toContain(
      '<Link to="/usage-analytics" className={`${styles.panelCard} ${styles.usagePanel}`}>'
    );
    expect(dashboard).toContain('<Link to="/monitoring" className={styles.panelAction}>');
    expect(dashboard).toContain('<Link to="/usage-analytics" className={styles.panelAction}>');
    expect(dashboard).toContain('type="button"');
    expect(dashboard).toContain('refreshDashboardRecentRequests');
  });

  test('turns dashboard utility controls into real range and refresh interactions', () => {
    const dashboard = read('src/pages/DashboardPage.tsx');
    const styles = read('src/pages/DashboardPage.module.scss');

    expect(dashboard).toContain('dashboardUsageRange');
    expect(dashboard).toContain('dashboardRecentLoading');
    expect(dashboard).toContain('dashboardTrendLoading');
    expect(dashboard).toContain('DASHBOARD_USAGE_RANGE_OPTIONS.map');
    expect(dashboard).toContain('setUsageRangeMenuOpen((open) => !open)');
    expect(dashboard).toContain('role="menu"');
    expect(dashboard).toContain('buildDashboardTrendRequest(Date.now(), dashboardUsageRange)');
    expect(dashboard).toContain('buildDashboardRecentEventsRequest(Date.now())');
    expect(dashboard).toContain('buildDashboardRangeTrend');
    expect(dashboard).toContain('loadingIconButton');
    expect(styles).toContain('.periodMenu');
    expect(styles).toContain('.periodMenuItemActive');
    expect(styles).toContain('.loadingIconButton');
  });
});
