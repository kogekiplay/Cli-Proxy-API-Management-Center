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
    expect(dashboard).toContain('dashboardGrid');
    expect(dashboard).toContain('rightRail');
    expect(dashboardStyles).toContain('.pageMasthead');
    expect(dashboardStyles).toContain('.dashboardGrid');
    expect(dashboardStyles).toContain('.rightRail');
    expect(dashboardStyles).toContain('.summaryCard');
    expect(dashboardStyles).toContain('.miniChart');
    expect(dashboardStyles).not.toContain('.backgroundOrbs');
    expect(dashboardStyles).not.toContain('.opsHero');
  });

  test('keeps usage pages in a dense operations toolbar style', () => {
    const usageStyles = read('src/pages/UsageAnalyticsPage.module.scss');

    expect(usageStyles).toContain('.operationsToolbar');
    expect(usageStyles).toContain('.metricCard::before');
    expect(usageStyles).toContain('background: var(--ops-panel-bg)');
  });
});
