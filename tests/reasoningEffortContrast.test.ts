import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

const styles = readFileSync('src/pages/UsageAnalyticsPage.module.scss', 'utf8');

const darkBadgeColors = {
  low: { foreground: '#86efac', background: '#052e16' },
  medium: { foreground: '#93c5fd', background: '#172554' },
  high: { foreground: '#fdba74', background: '#431407' },
  xhigh: { foreground: '#fca5a5', background: '#450a0a' },
} as const;

const relativeLuminance = (hex: string) => {
  const channels = [0, 2, 4].map((offset) => parseInt(hex.slice(offset + 1, offset + 3), 16) / 255);
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const contrastRatio = (foreground: string, background: string) => {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
};

const darkBadgeRule = (tone: keyof typeof darkBadgeColors) => {
  const className = `reasoningEffortBadge${tone[0].toUpperCase()}${tone.slice(1)}`;
  const match = styles.match(
    new RegExp(
      `:global\\(\\[data-theme='dark'\\]\\) \\.${className}\\s*\\{([^}]*)\\}`
    )
  );
  expect(match, `missing dark theme override for ${tone}`).not.toBeNull();
  return match?.[1] ?? '';
};

describe('request monitoring reasoning badge contrast', () => {
  test('keeps every dark reasoning level at WCAG AA contrast', () => {
    for (const [tone, colors] of Object.entries(darkBadgeColors) as Array<
      [keyof typeof darkBadgeColors, (typeof darkBadgeColors)[keyof typeof darkBadgeColors]]
    >) {
      const declarations = darkBadgeRule(tone);
      expect(declarations).toContain(`color: ${colors.foreground};`);
      expect(declarations).toContain(`background: ${colors.background};`);
      expect(contrastRatio(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
