import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('quick start advertising entry', () => {
  test('is not exposed from navigation, routes, or dashboard cards', () => {
    const sources = [
      read('src/router/MainRoutes.tsx'),
      read('src/components/layout/MainLayout.tsx'),
      read('src/pages/DashboardPage.tsx'),
      read('src/features/providers/ProvidersWorkbenchPage.tsx'),
      read('src/features/providers/sheets/ProviderSheet.tsx'),
    ].join('\n');

    expect(sources).not.toContain('/quick-start');
    expect(sources).not.toContain('quick_start');
    expect(sources).not.toContain('QuickStart');
    expect(sources).not.toContain('SponsorQuickStartPanel');
  });
});
