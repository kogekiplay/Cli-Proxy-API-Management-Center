/**
 * API key access scope management.
 */

import { apiClient } from './client';
import type {
  ApiKeyAccessProviderTarget,
  ApiKeyAccessRule,
  ApiKeyAccessRules,
} from '@/types/config';
import { serializeApiKeyAccessRules } from '@/utils/apiKeyAccessRules';

export interface ApiKeyAccessKeyView {
  key: string;
  label: string;
  'has-rule'?: boolean;
}

export interface ApiKeyAccessAuthTarget {
  id: string;
  provider: string;
  'base-url'?: string;
  base_url?: string;
  'provider-target'?:
    | ApiKeyAccessProviderTarget
    | { provider?: string; 'base-url'?: string; base_url?: string };
  provider_target?:
    | ApiKeyAccessProviderTarget
    | { provider?: string; 'base-url'?: string; base_url?: string };
  type?: string;
  name?: string;
  filename?: string;
  label?: string;
  'auth-index'?: number;
  auth_index?: number;
  email?: string;
  project_id?: string;
  'project-id'?: string;
  path?: string;
  status?: string;
  disabled?: boolean;
  unavailable?: boolean;
}

export interface ApiKeyAccessProviderTargetResponse {
  provider?: string;
  baseUrl?: string;
  'base-url'?: string;
  base_url?: string;
}

export interface ApiKeyAccessResponse {
  'api-key-access': ApiKeyAccessRules;
  'api-keys': ApiKeyAccessKeyView[];
  'auth-targets': ApiKeyAccessAuthTarget[];
  'provider-targets'?: ApiKeyAccessProviderTargetResponse[];
  provider_targets?: ApiKeyAccessProviderTargetResponse[];
}

export const apiKeyAccessApi = {
  get: () => apiClient.get<ApiKeyAccessResponse>('/api-key-access'),

  replace: (rules: ApiKeyAccessRules) =>
    apiClient.put('/api-key-access', { 'api-key-access': serializeApiKeyAccessRules(rules) }),

  update: (key: string, rule: ApiKeyAccessRule) => {
    const serialized = serializeApiKeyAccessRules({ [key]: rule });
    return apiClient.patch('/api-key-access', {
      key,
      rule: serialized[key.trim()] ?? {},
    });
  },

  delete: (key: string) => apiClient.delete(`/api-key-access?key=${encodeURIComponent(key)}`),
};
