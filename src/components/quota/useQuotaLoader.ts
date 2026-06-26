/**
 * Generic hook for quota data fetching and management.
 */

import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { AuthFileItem } from '@/types';
import { useAuthStore, useQuotaStore } from '@/stores';
import { normalizeAuthIndex } from '@/utils/authIndex';
import { getStatusFromError } from '@/utils/quota';
import type { QuotaConfig } from './quotaConfigs';

type QuotaScope = 'page' | 'all';

type QuotaUpdater<T> = T | ((prev: T) => T);

type QuotaSetter<T> = (updater: QuotaUpdater<T>) => void;

interface LoadQuotaResult<TData> {
  key: string;
  status: 'success' | 'error';
  data?: TData;
  error?: string;
  errorStatus?: number;
}

const shortHash = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export const buildQuotaCacheKey = (type: string, file: AuthFileItem): string => {
  const { apiBase, managementKey } = useAuthStore.getState();
  const authIndex = normalizeAuthIndex(file['auth_index'] ?? file.authIndex) || 'no-auth-index';
  const keyFingerprint = managementKey ? shortHash(managementKey) : 'no-key';
  return [
    apiBase.trim() || 'no-api-base',
    keyFingerprint,
    type,
    authIndex,
    file.name,
  ].join('|');
};

export function useQuotaLoader<TState, TData>(config: QuotaConfig<TState, TData>) {
  const { t } = useTranslation();
  const quota = useQuotaStore(config.storeSelector);
  const setQuota = useQuotaStore((state) => state[config.storeSetter]) as QuotaSetter<
    Record<string, TState>
  >;

  const loadingRef = useRef(false);
  const requestIdRef = useRef(0);

  const loadQuota = useCallback(
    async (
      targets: AuthFileItem[],
      scope: QuotaScope,
      setLoading: (loading: boolean, scope?: QuotaScope | null) => void
    ) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      const requestId = ++requestIdRef.current;
      setLoading(true, scope);

      try {
        if (targets.length === 0) return;

        setQuota((prev) => {
          const nextState = { ...prev };
          targets.forEach((file) => {
            nextState[buildQuotaCacheKey(config.type, file)] = config.buildLoadingState();
          });
          return nextState;
        });

        const results = await Promise.all(
          targets.map(async (file): Promise<LoadQuotaResult<TData>> => {
            const key = buildQuotaCacheKey(config.type, file);
            try {
              const data = await config.fetchQuota(file, t);
              return { key, status: 'success', data };
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : t('common.unknown_error');
              const errorStatus = getStatusFromError(err);
              return { key, status: 'error', error: message, errorStatus };
            }
          })
        );

        if (requestId !== requestIdRef.current) return;

        setQuota((prev) => {
          const nextState = { ...prev };
          results.forEach((result) => {
            if (result.status === 'success') {
              nextState[result.key] = config.buildSuccessState(result.data as TData);
            } else {
              nextState[result.key] = config.buildErrorState(
                result.error || t('common.unknown_error'),
                result.errorStatus
              );
            }
          });
          return nextState;
        });
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          loadingRef.current = false;
        }
      }
    },
    [config, setQuota, t]
  );

  return { quota, loadQuota };
}
