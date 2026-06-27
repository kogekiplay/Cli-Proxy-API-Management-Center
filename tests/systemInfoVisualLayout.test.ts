import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('management center info visual layout', () => {
  test('uses the operations-console system info structure', () => {
    const page = read('src/pages/SystemPage.tsx');
    const styles = read('src/pages/SystemPage.module.scss');

    expect(page).toContain('systemHero');
    expect(page).toContain('quickLinkGrid');
    expect(page).toContain('modelGroupRow');
    expect(page).toContain('localResourceCard');
    expect(page).toContain('systemFooter');

    expect(styles).toContain('.systemHero');
    expect(styles).toContain('.quickLinkGrid');
    expect(styles).toContain('.modelGroupRow');
    expect(styles).toContain('.localResourceCard');
    expect(styles).not.toContain('.aboutCard');
  });
});
