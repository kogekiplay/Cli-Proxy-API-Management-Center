import { apiClient } from './client';
import type { UsageSummary, UsageSummaryParams } from '@/types/usage';

const appendParam = (params: URLSearchParams, key: string, value: string | undefined) => {
  const trimmed = value?.trim();
  if (trimmed) params.set(key, trimmed);
};

export const usageSummaryApi = {
  get(query: UsageSummaryParams): Promise<UsageSummary> {
    const params = new URLSearchParams();
    params.set('provider', query.provider);
    appendParam(params, 'model', query.model);
    appendParam(params, 'auth_index', query.authIndex);
    appendParam(params, 'api_key_hash', query.apiKeyHash);
    appendParam(params, 'account_ref', query.accountRef);
    appendParam(params, 'window', query.window);
    appendParam(params, 'reset_at', query.resetAt);
    appendParam(params, 'start', query.start);
    appendParam(params, 'end', query.end);
    return apiClient.get<UsageSummary>(`/usage-summary?${params.toString()}`);
  },
};
