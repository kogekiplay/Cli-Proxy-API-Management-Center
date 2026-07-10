import { describe, expect, test } from 'bun:test';
import * as tooltip from '../src/features/usageAnalytics/usageStatusBadgeTooltip';
import {
  getUsageStatusTooltipPosition,
  isUsageStatusBadgeActivationKey,
  isUsageStatusTooltipVisible,
} from '../src/features/usageAnalytics/usageStatusBadgeTooltip';

type ScrollTopResolver = (args: {
  key: string;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}) => number | null;

type TooltipVisibilityCase = {
  hovered: boolean;
  focused: boolean;
};

const tooltipVisibilityCases: ReadonlyArray<readonly [TooltipVisibilityCase, boolean]> = [
  [{ hovered: false, focused: false }, false],
  [{ hovered: true, focused: false }, true],
  [{ hovered: false, focused: true }, true],
  [{ hovered: true, focused: true }, true],
];

const getUsageStatusTooltipScrollTop = tooltip.getUsageStatusTooltipScrollTop as
  | ScrollTopResolver
  | undefined;

describe('usage status badge tooltip behavior', () => {
  test.each(tooltipVisibilityCases)(
    'keeps visibility when hover and focus are %o',
    (state, expected) => {
      expect(isUsageStatusTooltipVisible(state)).toBe(expected);
    }
  );

  test('places a tooltip above the badge and clamps it within the viewport', () => {
    expect(
      getUsageStatusTooltipPosition(
        { top: 190, left: 250, width: 24, bottom: 214 },
        { width: 160, height: 80 },
        { width: 320, height: 240 }
      )
    ).toEqual({ top: 102, left: 148 });
  });

  test('clamps a tooltip to the viewport padding when there is no room above', () => {
    expect(
      getUsageStatusTooltipPosition(
        { top: 4, left: -20, width: 24, bottom: 28 },
        { width: 160, height: 80 },
        { width: 320, height: 240 }
      )
    ).toEqual({ top: 36, left: 12 });
  });

  test('pins a tooltip taller than a short viewport to the viewport padding', () => {
    expect(
      getUsageStatusTooltipPosition(
        { top: 30, left: 150, width: 24, bottom: 54 },
        { width: 160, height: 240 },
        { width: 320, height: 120 }
      )
    ).toEqual({ top: 12, left: 82 });
  });

  test('recognizes badge activation keys without treating Tab as activation', () => {
    expect(isUsageStatusBadgeActivationKey('Enter')).toBe(true);
    expect(isUsageStatusBadgeActivationKey(' ')).toBe(true);
    expect(isUsageStatusBadgeActivationKey('Tab')).toBe(false);
  });

  test('maps navigation keys to bounded tooltip scroll positions', () => {
    expect(typeof getUsageStatusTooltipScrollTop).toBe('function');
    const resolveScrollTop = getUsageStatusTooltipScrollTop!;
    const metrics = { scrollTop: 40, scrollHeight: 700, clientHeight: 200 };

    expect(resolveScrollTop({ ...metrics, key: 'ArrowDown' })).toBe(80);
    expect(resolveScrollTop({ ...metrics, key: ' ' })).toBe(240);
    expect(resolveScrollTop({ ...metrics, key: 'PageUp' })).toBe(0);
    expect(resolveScrollTop({ ...metrics, key: 'End' })).toBe(500);
    expect(resolveScrollTop({ ...metrics, key: 'Tab' })).toBeNull();
  });
});
