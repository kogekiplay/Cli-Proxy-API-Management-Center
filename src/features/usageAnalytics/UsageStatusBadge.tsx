import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { UsageAnalyticsEventRow } from '@/services/api/usageAnalytics';
import { resolveUsageAnalyticsErrorDisplay } from './usageAnalyticsErrorDisplay';
import styles from './UsageStatusBadge.module.scss';

const VIEWPORT_PADDING = 12;
const TOOLTIP_GAP = 8;

const statusCodeOf = (row: UsageAnalyticsEventRow) =>
  row.status_code || row.fail_status_code || (row.failed ? 500 : 200);

const statusToneOf = (row: UsageAnalyticsEventRow) => {
  const code = statusCodeOf(row);
  if (row.failed || code >= 500) return styles.failed;
  if (code >= 400) return styles.warn;
  return styles.success;
};

export function UsageStatusBadge({ row }: { row: UsageAnalyticsEventRow }) {
  const badgeRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const error = resolveUsageAnalyticsErrorDisplay(row, '请求失败');
  const hasError = row.failed && Boolean(error.summary || error.title || error.detail);

  const updatePosition = useCallback(() => {
    const badgeRect = badgeRef.current?.getBoundingClientRect();
    const tooltipRect = tooltipRef.current?.getBoundingClientRect();
    if (!badgeRect || !tooltipRect) return;

    const maxTop = Math.max(VIEWPORT_PADDING, window.innerHeight - tooltipRect.height - VIEWPORT_PADDING);
    const below = badgeRect.bottom + TOOLTIP_GAP;
    const top = Math.min(
      Math.max(
        below + tooltipRect.height > window.innerHeight - VIEWPORT_PADDING
          ? badgeRect.top - tooltipRect.height - TOOLTIP_GAP
          : below,
        VIEWPORT_PADDING
      ),
      maxTop
    );
    const maxLeft = Math.max(VIEWPORT_PADDING, window.innerWidth - tooltipRect.width - VIEWPORT_PADDING);
    const left = Math.min(
      Math.max(badgeRect.left + badgeRect.width / 2 - tooltipRect.width / 2, VIEWPORT_PADDING),
      maxLeft
    );

    setPosition({ top, left });
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

  const open = () => {
    if (hasError) setVisible(true);
  };

  const close = () => setVisible(false);

  return (
    <span className={styles.anchor} onPointerEnter={open} onPointerLeave={close}>
      <span
        ref={badgeRef}
        tabIndex={hasError ? 0 : undefined}
        aria-describedby={hasError ? tooltipId : undefined}
        className={`${styles.badge} ${statusToneOf(row)}`}
        onFocus={open}
        onBlur={close}
      >
        {statusCodeOf(row)}
      </span>
      {hasError && visible && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={tooltipRef}
              id={tooltipId}
              className={styles.tooltip}
              role="tooltip"
              style={position}
            >
              {error.title ? <strong>{error.title}</strong> : null}
              {error.summary && error.summary !== error.title ? <span>{error.summary}</span> : null}
              {error.detail ? <small>{error.detail}</small> : null}
            </div>,
            document.body
          )
        : null}
    </span>
  );
}
