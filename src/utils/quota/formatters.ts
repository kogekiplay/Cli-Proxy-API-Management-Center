/**
 * Formatting functions for quota display.
 */

import type { TFunction } from 'i18next';
import type { CodexUsageWindow } from '@/types';
import { normalizeNumberValue } from './parsers';

export function formatQuotaResetTime(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatUnixSeconds(value: number | null): string {
  if (!value) return '-';
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatCodexResetLabel(window?: CodexUsageWindow | null): string {
  if (!window) return '-';
  const resetAt = normalizeNumberValue(window.reset_at ?? window.resetAt);
  if (resetAt !== null && resetAt > 0) {
    return formatUnixSeconds(resetAt);
  }
  const resetAfter = normalizeNumberValue(window.reset_after_seconds ?? window.resetAfterSeconds);
  if (resetAfter !== null && resetAfter > 0) {
    const targetSeconds = Math.floor(Date.now() / 1000 + resetAfter);
    return formatUnixSeconds(targetSeconds);
  }
  return '-';
}

export function createStatusError(message: string, status?: number): Error & { status?: number } {
  const error = new Error(message) as Error & { status?: number };
  if (status !== undefined) {
    error.status = status;
  }
  return error;
}

export function getStatusFromError(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const rawStatus = (err as { status?: unknown }).status;
    if (typeof rawStatus === 'number' && Number.isFinite(rawStatus)) {
      return rawStatus;
    }
    const asNumber = Number(rawStatus);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return asNumber;
    }
  }
  return undefined;
}

export function formatKimiResetDate(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
}

export function formatKimiResetHint(t: TFunction, hint?: string): string {
  if (!hint) return '';
  return t('kimi_quota.reset_hint', { hint });
}
