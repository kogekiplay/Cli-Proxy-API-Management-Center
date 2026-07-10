import { describe, expect, test } from 'bun:test';
import {
  getUsageStatusTooltipPosition,
  isUsageStatusBadgeActivationKey,
  isUsageStatusTooltipVisible,
} from '../src/features/usageAnalytics/usageStatusBadgeTooltip';

describe('usage status badge tooltip behavior', () => {
  test.each([
    [{ hovered: false, focused: false }, false],
    [{ hovered: true, focused: false }, true],
    [{ hovered: false, focused: true }, true],
    [{ hovered: true, focused: true }, true],
  ])('keeps visibility when hover and focus are %o', (state, expected) => {
    expect(isUsageStatusTooltipVisible(state)).toBe(expected);
  });

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

  test('recognizes badge activation keys without treating Tab as activation', () => {
    expect(isUsageStatusBadgeActivationKey('Enter')).toBe(true);
    expect(isUsageStatusBadgeActivationKey(' ')).toBe(true);
    expect(isUsageStatusBadgeActivationKey('Tab')).toBe(false);
  });
});
