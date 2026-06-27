import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('config routing strategy quick setting', () => {
  test('exposes a direct routing strategy control on the config page', () => {
    const configPage = read('src/pages/ConfigPage.tsx');
    const styles = read('src/pages/ConfigPage.module.scss');

    expect(configPage).toContain("import { configApi } from '@/services/api/config';");
    expect(configPage).toContain('getRoutingStrategy()');
    expect(configPage).toContain('configApi.updateRoutingStrategy(nextStrategy)');
    expect(configPage).toContain('routingQuickCard');
    expect(configPage).toContain('routingStrategyOptions.map');
    expect(configPage).toContain("defaultLabel: '轮询'");
    expect(configPage).toContain("defaultLabel: '填满优先'");
    expect(styles).toContain('.routingQuickCard');
    expect(styles).toContain('.routingStrategyButtonActive');
  });
});
