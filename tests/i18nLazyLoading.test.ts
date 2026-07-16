import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('i18n bundle loading', () => {
  test('keeps only the default fallback locale in the initial bundle', () => {
    const i18n = read('src/i18n/index.ts');
    const main = read('src/main.tsx');

    expect(i18n).toContain("import zhCN from './locales/zh-CN.json';");
    expect(i18n).toContain("import('./locales/zh-TW.json')");
    expect(i18n).toContain("import('./locales/en.json')");
    expect(i18n).toContain("import('./locales/ru.json')");
    expect(i18n).not.toContain("import zhTW from './locales/zh-TW.json';");
    expect(i18n).not.toContain("import en from './locales/en.json';");
    expect(i18n).not.toContain("import ru from './locales/ru.json';");
    expect(main).toContain('await initializeI18n();');
  });
});
