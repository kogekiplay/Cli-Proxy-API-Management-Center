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
});
