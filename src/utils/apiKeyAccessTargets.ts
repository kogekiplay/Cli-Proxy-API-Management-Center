import type { ApiKeyAccessProviderTarget } from '@/types/config';

export interface ApiKeyAccessAuthTargetLike {
  id?: string;
  provider?: string;
  name?: string;
  filename?: string;
  label?: string;
  email?: string;
  'base-url'?: string;
  base_url?: string;
  'provider-target'?:
    | ApiKeyAccessProviderTarget
    | { provider?: string; 'base-url'?: string; base_url?: string };
  provider_target?:
    | ApiKeyAccessProviderTarget
    | { provider?: string; 'base-url'?: string; base_url?: string };
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

export function getApiKeyAccessAuthTargetValue(target: ApiKeyAccessAuthTargetLike): string {
  return firstNonEmpty(target.filename, target.name, target.id);
}

export function getApiKeyAccessAuthTargetLabel(target: ApiKeyAccessAuthTargetLike): string {
  const label = firstNonEmpty(target.label, target.email, target.name, target.filename, target.id);
  const provider = firstNonEmpty(target.provider);
  return provider ? `${provider} / ${label}` : label;
}

export function getApiKeyAccessAuthTargetBaseUrl(target: ApiKeyAccessAuthTargetLike): string {
  const providerTarget = target['provider-target'] ?? target.provider_target;
  if (providerTarget && typeof providerTarget === 'object') {
    const nestedBaseUrl =
      'baseUrl' in providerTarget
        ? providerTarget.baseUrl
        : (providerTarget['base-url'] ?? providerTarget.base_url);
    if (typeof nestedBaseUrl === 'string') return nestedBaseUrl.trim();
  }
  return firstNonEmpty(target['base-url'], target.base_url);
}
