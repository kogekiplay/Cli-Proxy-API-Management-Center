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

export interface ApiKeyAccessProviderTargetLike {
  provider?: string;
  baseUrl?: string;
  'base-url'?: string;
  base_url?: string;
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

function normalizeProviderTarget(
  target: ApiKeyAccessProviderTargetLike | undefined
): ApiKeyAccessProviderTarget | null {
  if (!target || typeof target !== 'object') return null;
  const provider = firstNonEmpty(target.provider).toLowerCase();
  const baseUrl = firstNonEmpty(target.baseUrl, target['base-url'], target.base_url);
  if (!provider || !baseUrl) return null;
  return { provider, baseUrl };
}

function uniqueProviderTargets(targets: Array<ApiKeyAccessProviderTarget | null>) {
  const seen = new Set<string>();
  const out: ApiKeyAccessProviderTarget[] = [];
  for (const target of targets) {
    if (!target) continue;
    const key = `${target.provider}\u0000${target.baseUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(target);
  }
  return out;
}

export function getApiKeyAccessProviderTargetsForPicker(
  configuredProviderTargets: ApiKeyAccessProviderTargetLike[] | undefined,
  authTargets: ApiKeyAccessAuthTargetLike[] | undefined
): ApiKeyAccessProviderTarget[] {
  const configured = uniqueProviderTargets(
    (configuredProviderTargets ?? []).map(normalizeProviderTarget)
  );
  if (Array.isArray(configuredProviderTargets)) return configured;

  return uniqueProviderTargets(
    (authTargets ?? []).map((target) =>
      normalizeProviderTarget({
        provider: target.provider,
        baseUrl: getApiKeyAccessAuthTargetBaseUrl(target),
      })
    )
  );
}
