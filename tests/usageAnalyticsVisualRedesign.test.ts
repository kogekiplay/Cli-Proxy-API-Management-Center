import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('usage analytics visual redesign', () => {
  test('splits usage analytics into overview and complete analysis views', () => {
    const page = read('src/pages/UsageAnalyticsPage.tsx');

    expect(page).toContain(
      "const [analysisMode, setAnalysisMode] = useState<'overview' | 'complete'>"
    );
    expect(page).toContain('renderFilters()');
    expect(page).toContain('renderOverviewAnalytics()');
    expect(page).toContain('renderCompleteAnalysis()');
    expect(page).toContain("setAnalysisMode('complete')");
    expect(page).toContain("setAnalysisMode('overview')");
    expect(page).toContain('完整分析');
    expect(page).toContain('返回用量分析');
    expect(page).toContain('switchAnalysisMode');
    expect(page).toContain('scrollToUsageAnalyticsTop');
  });

  test('adds the overview dashboard sections from the target design', () => {
    const page = read('src/pages/UsageAnalyticsPage.tsx');
    const styles = read('src/pages/UsageAnalyticsPage.module.scss');

    expect(page).toContain('overviewMainGrid');
    expect(page).toContain('insightRail');
    expect(page).toContain('Token 趋势');
    expect(page).toContain('洞察');
    expect(page).toContain('模型排行');
    expect(page).toContain('API Key 用量');
    expect(page).toContain('认证文件用量');
    expect(page).toContain('icon: <IconTrendingUp');
    expect(page).toContain('icon: <IconTrophy');
    expect(page).toContain('{item.icon}');
    expect(page).toContain('renderInsights(true)');
    expect(page).toContain('查看完整分析');
    expect(page).toContain('fillTokenTrendRows');
    expect(page).toContain('延迟表现');
    expect(page).toContain("tone: 'purple'");
    expect(styles).toContain('.overviewMainGrid');
    expect(styles).toContain('.insightRail');
    expect(styles).toContain('.overviewMainGrid .trendCard');
    expect(styles).toContain('.insightTonepurple');
    expect(styles).toContain('.rankGrid');
    expect(styles).toContain('display: inline-grid');
    expect(styles).toContain('border-radius: $radius-full');
  });

  test('adds complete analysis charts and recommendation sections', () => {
    const page = read('src/pages/UsageAnalyticsPage.tsx');
    const styles = read('src/pages/UsageAnalyticsPage.module.scss');

    expect(page).not.toContain('completeHeroGrid');
    expect(page).toContain('completeMetricStrip');
    expect(page).toContain('平均延迟 (P50)');
    expect(page).toContain('平均延迟 (P95)');
    expect(page).toContain('流量、Token 与费用趋势');
    expect(page).toContain('Provider 贡献');
    expect(page).toContain('失败原因分析');
    expect(page).toContain('时间段热力图');
    expect(page).toContain('费用拆分');
    expect(page).toContain('优化建议');
    expect(page).toContain('completeHeader');
    expect(page).toContain('completeDashboardGrid');
    expect(page).toContain('completeInsightColumn');
    expect(styles).toContain('.completeHeader');
    expect(styles).toContain('.completeDashboardGrid');
    expect(styles).toContain('.completeInsightColumn');
    expect(styles).not.toContain('.completeHeroGrid');
    expect(styles).toContain('.lineChart');
    expect(styles).toContain('.donutChart');
    expect(styles).toContain('.heatmapGrid');
    expect(styles).toContain('.recommendationGrid');
  });

  test('matches the reference complete analysis three-column masonry layout', () => {
    const page = read('src/pages/UsageAnalyticsPage.tsx');
    const styles = read('src/pages/UsageAnalyticsPage.module.scss');

    expect(page).toContain('completeLeftColumn');
    expect(page).toContain('completeMiddleColumn');
    expect(page).toContain('completeRightColumn');
    expect(page).toContain('completeContainer');
    expect(page).toContain('<div className={styles.completeLeftColumn}>');
    expect(page).toContain('<div className={styles.completeMiddleColumn}>');
    expect(page).toContain('<div className={styles.completeRightColumn}>');
    expect(page).toContain('renderInsights(false, 4)');
    expect(page).toContain("root.style.setProperty('--main-content-padding-x', '28px')");
    expect(page).toContain("root.style.setProperty('--sidebar-panel-width', '216px')");
    expect(page).toContain('HEATMAP_DAY_LABELS');
    expect(page).toContain('HEATMAP_HOUR_LABELS');
    expect(page).toContain('heatmapDayLabels');
    expect(styles).toContain('.completeLeftColumn,');
    expect(styles).toContain('.completeMiddleColumn,');
    expect(styles).toContain('.completeRightColumn');
    expect(styles).toContain('.completeContainer');
    expect(page).toContain('--main-content-padding-top');
    expect(page).toContain("root.style.setProperty('--main-content-padding-top', '24px')");
    expect(read('src/styles/layout.scss')).toContain(
      'var(--main-content-padding-x, clamp(20px, 3vw, 48px))'
    );
    expect(styles).toContain('grid-template-columns: minmax(0, 1.34fr) minmax(300px, 0.62fr) minmax(360px, 0.95fr);');
    expect(styles).toContain('.completeRightColumn .recommendationGrid');
    expect(styles).toContain('grid-template-columns: 1fr;');
    expect(styles).toContain('.completeMiddleColumn > *,');
    expect(styles).toContain('max-width: 100%;');
    expect(styles).toContain('.heatmapDayLabels');
    expect(styles).toContain('grid-template-columns: repeat(24, minmax(0, 1fr));');
  });
});
