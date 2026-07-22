/**
 * Kimi web subscription stats API (proxied via management API).
 */

import type { AxiosRequestConfig } from 'axios';
import { apiClient } from './client';

export interface KimiSubscriptionStatsRequest {
  authIndex: string;
}

export interface KimiSubscriptionStatsResponse {
  total_usage_percent?: number | null;
  total_reset_at?: string | null;
  five_hour_code_percent?: number | null;
  five_hour_reset_at?: string | null;
  weekly_code_percent?: number | null;
  weekly_reset_at?: string | null;
  error?: string;
}

export const kimiSubscriptionStatsApi = {
  request: async (
    payload: KimiSubscriptionStatsRequest,
    config?: AxiosRequestConfig
  ): Promise<KimiSubscriptionStatsResponse> => {
    const response = await apiClient.post<KimiSubscriptionStatsResponse>(
      '/kimi-subscription-stats',
      payload,
      config
    );
    return response;
  },
};
