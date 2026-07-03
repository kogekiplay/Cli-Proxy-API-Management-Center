import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('config routing strategy quick setting', () => {
  test('exposes a direct routing strategy control in advanced visual settings', () => {
    const configPage = read('src/pages/ConfigPage.tsx');
    const editor = read('src/components/config/VisualConfigEditor.tsx');
    const styles = read('src/components/config/VisualConfigEditor.module.scss');

    expect(configPage).toContain("import { configApi } from '@/services/api/config';");
    expect(configPage).toContain('getRoutingStrategy()');
    expect(configPage).toContain('configApi.updateRoutingStrategy(nextStrategy)');
    expect(configPage).toContain('routingStrategyControl={{');
    expect(editor).toContain('const routingStrategyOptions');
    expect(editor).toContain('routingStrategyControlBlock');
    expect(editor).toContain('{routingStrategyControlBlock}');
    expect(editor).toContain("defaultLabel: 'round-robin (轮询)'");
    expect(editor).toContain("defaultLabel: 'fill-first (优先填充)'");
    expect(styles).toContain('.routingStrategyOptions');
    expect(styles).toContain('.routingStrategyButtonActive');
  });
});
