const VIEWPORT_PADDING = 12;
const TOOLTIP_GAP = 8;
const TOOLTIP_SCROLL_STEP = 40;

export interface UsageStatusTooltipAnchor {
  top: number;
  left: number;
  width: number;
  bottom: number;
}

export interface UsageStatusTooltipSize {
  width: number;
  height: number;
}

export interface UsageStatusTooltipViewport {
  width: number;
  height: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const isUsageStatusTooltipVisible = ({
  hovered,
  focused,
}: {
  hovered: boolean;
  focused: boolean;
}) => hovered || focused;

export const getUsageStatusTooltipPosition = (
  anchor: UsageStatusTooltipAnchor,
  tooltip: UsageStatusTooltipSize,
  viewport: UsageStatusTooltipViewport
) => {
  const maxTop = Math.max(VIEWPORT_PADDING, viewport.height - tooltip.height - VIEWPORT_PADDING);
  const below = anchor.bottom + TOOLTIP_GAP;
  const preferredTop =
    below + tooltip.height <= viewport.height - VIEWPORT_PADDING
      ? below
      : anchor.top - tooltip.height - TOOLTIP_GAP;
  const maxLeft = Math.max(VIEWPORT_PADDING, viewport.width - tooltip.width - VIEWPORT_PADDING);

  return {
    top: clamp(preferredTop, VIEWPORT_PADDING, maxTop),
    left: clamp(anchor.left + anchor.width / 2 - tooltip.width / 2, VIEWPORT_PADDING, maxLeft),
  };
};

export const getUsageStatusTooltipScrollTop = ({
  key,
  scrollTop,
  scrollHeight,
  clientHeight,
}: {
  key: string;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}) => {
  const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
  const currentScrollTop = clamp(scrollTop, 0, maxScrollTop);

  if (key === 'ArrowDown') return Math.min(maxScrollTop, currentScrollTop + TOOLTIP_SCROLL_STEP);
  if (key === 'ArrowUp') return Math.max(0, currentScrollTop - TOOLTIP_SCROLL_STEP);
  if (key === ' ' || key === 'PageDown') return Math.min(maxScrollTop, currentScrollTop + clientHeight);
  if (key === 'PageUp') return Math.max(0, currentScrollTop - clientHeight);
  if (key === 'Home') return 0;
  if (key === 'End') return maxScrollTop;
  return null;
};

export const isUsageStatusBadgeActivationKey = (key: string) => key === 'Enter' || key === ' ';
