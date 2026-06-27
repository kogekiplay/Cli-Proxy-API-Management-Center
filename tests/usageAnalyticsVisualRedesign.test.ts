import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('usage analytics visual redesign', () => {
  test('splits usage analytics into overview and complete analysis views', () => {
    const page = read('src/pages/UsageAnalyticsPage.tsx');

    expect(page).toContain("const [analysisMode, setAnalysisMode] = useState<'overview' | 'complete'>");
    expect(page).toContain('renderFilters()');
    expect(page).toContain('renderOverviewAnalytics()');
    expect(page).toContain('renderCompleteAnalysis()');
    expect(page).toContain("setAnalysisMode('complete')");
    expect(page).toContain("setAnalysisMode('overview')");
    expect(page).toContain('完整分析');
    expect(page).toContain('返回概览');
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
    expect(styles).toContain('.overviewMainGrid');
    expect(styles).toContain('.insightRail');
    expect(styles).toContain('.rankGrid');
  });

  test('adds complete analysis charts and recommendation sections', () => {
    const page = read('src/pages/UsageAnalyticsPage.tsx');
    const styles = read('src/pages/UsageAnalyticsPage.module.scss');

    expect(page).toContain('completeHeroGrid');
    expect(page).toContain('关键指标');
    expect(page).toContain('流量、Token 与费用趋势');
    expect(page).toContain('Provider 贡献');
    expect(page).toContain('失败原因分析');
    expect(page).toContain('时间段热力图');
    expect(page).toContain('费用拆分');
    expect(page).toContain('优化建议');
    expect(styles).toContain('.completeHeroGrid');
    expect(styles).toContain('.lineChart');
    expect(styles).toContain('.donutChart');
    expect(styles).toContain('.heatmapGrid');
    expect(styles).toContain('.recommendationGrid');
  });
});
