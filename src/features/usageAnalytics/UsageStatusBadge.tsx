import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { UsageAnalyticsEventRow } from '@/services/api/usageAnalytics';
import { resolveUsageAnalyticsErrorDisplay } from './usageAnalyticsErrorDisplay';
import {
  getUsageStatusTooltipPosition,
  getUsageStatusTooltipScrollTop,
  isUsageStatusBadgeActivationKey,
  isUsageStatusTooltipVisible,
} from './usageStatusBadgeTooltip';
import styles from './UsageStatusBadge.module.scss';

const statusCodeOf = (row: UsageAnalyticsEventRow) =>
  row.status_code || row.fail_status_code || (row.failed ? 500 : 200);

const statusToneOf = (row: UsageAnalyticsEventRow) => {
  const code = statusCodeOf(row);
  if (row.failed || code >= 500) return styles.failed;
  if (code >= 400) return styles.warn;
  return styles.success;
};

function UsageStatusTooltipContent({
  error,
}: {
  error: ReturnType<typeof resolveUsageAnalyticsErrorDisplay>;
}) {
  return (
    <>
      {error.title ? <strong>{error.title}</strong> : null}
      {error.summary && error.summary !== error.title ? <span>{error.summary}</span> : null}
      {error.detail ? <small>{error.detail}</small> : null}
    </>
  );
}

export function UsageStatusBadge({ row }: { row: UsageAnalyticsEventRow }) {
  const { t } = useTranslation();
  const badgeRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const error = resolveUsageAnalyticsErrorDisplay(row, t('usage_analytics.request_failed'));
  const hasError = row.failed && Boolean(error.summary || error.title || error.detail);
  const visible = hasError && isUsageStatusTooltipVisible({ hovered, focused });

  const updatePosition = useCallback(() => {
    const badgeRect = badgeRef.current?.getBoundingClientRect();
    const tooltipRect = tooltipRef.current?.getBoundingClientRect();
    if (!badgeRect || !tooltipRect) return;

    setPosition(
      getUsageStatusTooltipPosition(
        badgeRect,
        tooltipRect,
        { width: window.innerWidth, height: window.innerHeight }
      )
    );
  }, []);

  useLayoutEffect(() => {
    if (!visible) return;

    const animationFrame = window.requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [updatePosition, visible]);

  return (
    <span
      className={styles.anchor}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <span
        ref={badgeRef}
        tabIndex={hasError ? 0 : undefined}
        aria-describedby={hasError ? tooltipId : undefined}
        className={`${styles.badge} ${statusToneOf(row)}`}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => {
          const tooltip = tooltipRef.current;
          const nextScrollTop = tooltip
            ? getUsageStatusTooltipScrollTop({
                key: event.key,
                scrollTop: tooltip.scrollTop,
                scrollHeight: tooltip.scrollHeight,
                clientHeight: tooltip.clientHeight,
              })
            : null;

          if (nextScrollTop !== null) {
            event.preventDefault();
            event.stopPropagation();
            tooltipRef.current?.scrollTo({ top: nextScrollTop });
            return;
          }

          if (isUsageStatusBadgeActivationKey(event.key)) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {statusCodeOf(row)}
      </span>
      {hasError ? (
        <span id={tooltipId} className={styles.accessibleDescription}>
          <UsageStatusTooltipContent error={error} />
        </span>
      ) : null}
      {hasError && visible && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={tooltipRef}
              className={styles.tooltip}
              role="tooltip"
              style={position}
            >
              <UsageStatusTooltipContent error={error} />
            </div>,
            document.body
          )
        : null}
    </span>
  );
}
