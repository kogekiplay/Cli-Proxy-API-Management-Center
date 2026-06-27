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
    expect(dashboard).toContain('refreshDashboardUsage');
  });
});
