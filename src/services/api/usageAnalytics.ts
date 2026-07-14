import type { AxiosRequestConfig } from 'axios';
import { apiClient } from './client';

export interface UsageAnalyticsTokens {
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cached_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  total_tokens: number;
}

export interface UsageAnalyticsSummary {
  total_calls: number;
  success_calls: number;
  failure_calls: number;
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cached_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  total_tokens: number;
  total_cost?: number | null;
}

export interface UsageAnalyticsTimelinePoint {
  bucket_ms: number;
  calls: number;
  success: number;
  failure: number;
  total_tokens: number;
  cost?: number | null;
}

export interface UsageAnalyticsModelStat {
  model: string;
  calls: number;
  success_calls: number;
  failure_calls: number;
  total_tokens: number;
  cost?: number | null;
}

export interface UsageAnalyticsAPIKeyStat {
  provider: string;
  providers?: string[];
  api_key_hash: string;
  api_key_preview?: string;
  account_ref?: string;
  calls: number;
  success_calls: number;
  failure_calls: number;
  total_tokens: number;
  cost?: number | null;
}

export interface UsageAnalyticsCredentialStat {
  provider: string;
  auth_index: string;
  auth_file_name: string;
  credential_display_name?: string;
  account_ref: string;
  calls: number;
  success_calls: number;
  failure_calls: number;
  total_tokens: number;
  cost?: number | null;
}

export interface UsageAnalyticsEventRow {
  id: number;
  request_id: string;
  timestamp_ms: number;
  provider: string;
  model: string;
  upstream_model?: string;
  endpoint: string;
  auth_index: string;
  auth_file_name: string;
  credential_display_name?: string;
  api_key_hash: string;
  credential_key_hash?: string;
  account_ref: string;
  auth_type?: string;
  service_tier: string;
  reasoning_effort?: string;
  status_code?: number;
  latency_ms?: number | null;
  ttft_ms?: number | null;
  fail_status_code?: number;
  fail_summary?: string;
  fail_body?: string;
  tokens: UsageAnalyticsTokens;
  failed: boolean;
  estimated_cost_usd?: number | null;
  missing_price_model_name?: string;
}

export interface UsageAnalyticsEventsResponse {
  items: UsageAnalyticsEventRow[];
  next_before_ms?: number;
  next_before_id?: number;
  has_more: boolean;
  total_count: number;
}

export interface UsageAnalyticsResponse {
  generated_at_ms: number;
  summary?: UsageAnalyticsSummary;
  timeline?: UsageAnalyticsTimelinePoint[];
  model_stats?: UsageAnalyticsModelStat[];
  api_key_stats?: UsageAnalyticsAPIKeyStat[];
  credential_stats?: UsageAnalyticsCredentialStat[];
  events?: UsageAnalyticsEventsResponse;
}

export interface UsageAnalyticsRequest {
  from_ms: number;
  to_ms: number;
  filters?: {
    providers?: string[];
    models?: string[];
    auth_files?: string[];
    auth_indices?: string[];
    api_key_hashes?: string[];
    accounts?: string[];
    failed_only?: boolean;
    include_failed?: boolean;
  };
  include?: {
    summary?: boolean;
    timeline?: boolean;
    model_stats?: boolean;
    api_key_stats?: boolean;
    credential_stats?: boolean;
    events_page?: {
      limit?: number;
      before_ms?: number;
      before_id?: number;
    };
  };
}

export const usageAnalyticsApi = {
  query(
    request: UsageAnalyticsRequest,
    config?: AxiosRequestConfig
  ): Promise<UsageAnalyticsResponse> {
    return apiClient.post<UsageAnalyticsResponse>('/usage-analytics', request, config);
  },
};
