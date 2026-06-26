import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const TEXT_EXTENSIONS = new Set([
  '.css',
  '.json',
  '.scss',
  '.ts',
  '.tsx',
]);

const blockedPatterns = [
  /\/quick-start/i,
  /quick_start/i,
  /quickStart/i,
  /apikeyFun/i,
  /APIKEY_FUN/,
  /APIKEY\.FUN/i,
  /apikey\.fun/i,
  /SponsorProvider/i,
  /SponsorQuickStart/i,
];

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return walk(path);
    return [path];
  });

const extensionOf = (path: string) => {
  const match = path.match(/\.[^.]+$/);
  return match?.[0] ?? '';
};

describe('APIKEY.FUN management compatibility', () => {
  test('is not present in management source files or source paths', () => {
    const offenders: string[] = [];

    for (const path of walk('src')) {
      const normalizedPath = relative(process.cwd(), path).replaceAll('\\', '/');
      if (blockedPatterns.some((pattern) => pattern.test(normalizedPath))) {
        offenders.push(normalizedPath);
      }

      if (!TEXT_EXTENSIONS.has(extensionOf(path))) continue;

      const text = readFileSync(path, 'utf8');
      if (blockedPatterns.some((pattern) => pattern.test(text))) {
        offenders.push(normalizedPath);
      }
    }

    expect(offenders).toEqual([]);
  });
});
