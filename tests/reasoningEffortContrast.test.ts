import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

const styles = readFileSync('src/pages/UsageAnalyticsPage.module.scss', 'utf8');

const darkBadgeColors = {
  none: { foreground: '#c9c3bb', background: '#252320' },
  low: { foreground: '#86efac', background: '#052e16' },
  medium: { foreground: '#93c5fd', background: '#172554' },
  high: { foreground: '#fdba74', background: '#431407' },
  xhigh: { foreground: '#fca5a5', background: '#450a0a' },
} as const;

const maxBadgeColors = {
  foreground: '#ffffff',
  backgroundStart: '#7e22ce',
  backgroundEnd: '#db2777',
} as const;

const relativeLuminance = (hex: string) => {
  const normalizedHex = hex.length === 4 ? hex.replace(/./g, (channel) => channel + channel) : hex;
  const channels = [0, 2, 4].map(
    (offset) => parseInt(normalizedHex.slice(offset + 1, offset + 3), 16) / 255
  );
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

const badgeRule = (tone: keyof typeof darkBadgeColors) => {
  const className = `reasoningEffortBadge${tone[0].toUpperCase()}${tone.slice(1)}`;
  const match = styles.match(
    new RegExp(
      `(?:^|\\n)\\.${className}\\s*\\{([^}]*)\\}`
    )
  );
  expect(match, `missing base badge rule for ${tone}`).not.toBeNull();
  return match?.[1] ?? '';
};

const darkBadgeRule = (tone: Exclude<keyof typeof darkBadgeColors, 'none'>) => {
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
  test('covers all dark reasoning levels and both max gradient endpoints at WCAG AA contrast', () => {
    for (const [tone, colors] of Object.entries(darkBadgeColors) as Array<
      [keyof typeof darkBadgeColors, (typeof darkBadgeColors)[keyof typeof darkBadgeColors]]
    >) {
      const declarations = tone === 'none' ? badgeRule(tone) : darkBadgeRule(tone);
      if (tone === 'none') {
        expect(declarations).toContain('color: var(--text-secondary);');
        expect(declarations).toContain(
          'background: color-mix(in srgb, var(--text-tertiary) 12%, var(--bg-secondary));'
        );
      } else {
        expect(declarations).toContain(`color: ${colors.foreground};`);
        expect(declarations).toContain(`background: ${colors.background};`);
      }
      expect(contrastRatio(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5);
    }

    const maxDeclarations = badgeRule('max');
    expect(maxDeclarations).toContain(
      `background: linear-gradient(135deg, ${maxBadgeColors.backgroundStart}, ${maxBadgeColors.backgroundEnd});`
    );
    expect(maxDeclarations).toContain('color: #fff;');
    expect(
      contrastRatio(maxBadgeColors.foreground, maxBadgeColors.backgroundStart)
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(maxBadgeColors.foreground, maxBadgeColors.backgroundEnd)
    ).toBeGreaterThanOrEqual(4.5);
  });
});
