import type {
  ApiKeyAccessProviderTarget,
  ApiKeyAccessRule,
  ApiKeyAccessRules,
} from '@/types/config';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeStringList(raw: unknown, lowercase = false): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const value = String(item ?? '').trim();
    const normalized = lowercase ? value.toLowerCase() : value;
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function providerTargetKey(target: ApiKeyAccessProviderTarget): string {
  return `${target.provider.trim().toLowerCase()}\u0000${target.baseUrl.trim()}`;
}

export function normalizeApiKeyAccessProviderTargets(raw: unknown): ApiKeyAccessProviderTarget[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ApiKeyAccessProviderTarget[] = [];
  for (const item of raw) {
    const record = asRecord(item);
    if (!record) continue;
    const provider = String(record.provider ?? '')
      .trim()
      .toLowerCase();
    if (!provider) continue;
    const baseUrl = String(record['base-url'] ?? record.baseUrl ?? record.base_url ?? '').trim();
    const key = providerTargetKey({ provider, baseUrl });
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ provider, baseUrl });
  }
  return out;
}

export function parseApiKeyAccessRules(raw: unknown): ApiKeyAccessRules {
  const record = asRecord(raw);
  if (!record) return {};
  const out: ApiKeyAccessRules = {};
  Object.entries(record).forEach(([rawKey, rawRule]) => {
    const key = rawKey.trim();
    if (!key) return;
    const ruleRecord = asRecord(rawRule) ?? {};
    const accessRaw =
      typeof ruleRecord.access === 'string' ? ruleRecord.access.trim().toLowerCase() : '';
    const rule: ApiKeyAccessRule = {};
    if (accessRaw === 'all') {
      rule.access = 'all';
    } else {
      const providers = normalizeStringList(ruleRecord.providers, true);
      const providerTargets = normalizeApiKeyAccessProviderTargets(
        ruleRecord['provider-targets'] ?? ruleRecord.providerTargets ?? ruleRecord.provider_targets
      );
      const authFiles = normalizeStringList(
        ruleRecord['auth-files'] ?? ruleRecord.authFiles,
        false
      );
      if (providers.length > 0) rule.providers = providers;
      if (providerTargets.length > 0) rule.providerTargets = providerTargets;
      if (authFiles.length > 0) rule.authFiles = authFiles;
    }
    out[key] = rule;
  });
  return out;
}

export function canonicalApiKeyAccessRules(
  rules: ApiKeyAccessRules | undefined
): ApiKeyAccessRules {
  const parsed = parseApiKeyAccessRules(rules ?? {});
  const canonical: ApiKeyAccessRules = {};
  Object.entries(parsed)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([key, rule]) => {
      if (rule.access === 'all') {
        canonical[key] = { access: 'all' };
        return;
      }
      canonical[key] = {
        providers: [...(rule.providers ?? [])].sort(),
        providerTargets: [...(rule.providerTargets ?? [])].sort((left, right) => {
          const providerCompare = left.provider.localeCompare(right.provider);
          if (providerCompare !== 0) return providerCompare;
          return left.baseUrl.localeCompare(right.baseUrl);
        }),
        authFiles: [...(rule.authFiles ?? [])].sort(),
      };
    });
  return canonical;
}

export function areApiKeyAccessRulesEqual(
  left: ApiKeyAccessRules,
  right: ApiKeyAccessRules
): boolean {
  return (
    JSON.stringify(canonicalApiKeyAccessRules(left)) ===
    JSON.stringify(canonicalApiKeyAccessRules(right))
  );
}

export function pruneApiKeyAccessRules(
  rules: ApiKeyAccessRules,
  available: {
    providerTargets: ApiKeyAccessProviderTarget[];
    authFiles: string[];
  }
): ApiKeyAccessRules {
  const normalizedRules = parseApiKeyAccessRules(rules);
  const availableProviderTargetKeys = new Set(
    normalizeApiKeyAccessProviderTargets(available.providerTargets).map(providerTargetKey)
  );
  const availableProviders = new Set(
    normalizeApiKeyAccessProviderTargets(available.providerTargets).map((target) => target.provider)
  );
  const availableAuthFiles = new Set(normalizeStringList(available.authFiles, false));

  const pruned: ApiKeyAccessRules = {};
  Object.entries(normalizedRules).forEach(([key, rule]) => {
    if (rule.access === 'all') {
      pruned[key] = { access: 'all' };
      return;
    }

    const nextRule: ApiKeyAccessRule = {};
    const providers = normalizeStringList(rule.providers, true).filter((provider) =>
      availableProviders.has(provider)
    );
    const providerTargets = normalizeApiKeyAccessProviderTargets(rule.providerTargets).filter(
      (target) => availableProviderTargetKeys.has(providerTargetKey(target))
    );
    const authFiles = normalizeStringList(rule.authFiles, false).filter((authFile) =>
      availableAuthFiles.has(authFile)
    );

    if (providers.length > 0) nextRule.providers = providers;
    if (providerTargets.length > 0) nextRule.providerTargets = providerTargets;
    if (authFiles.length > 0) nextRule.authFiles = authFiles;
    pruned[key] = nextRule;
  });

  return pruned;
}

export function serializeApiKeyAccessRules(rules: ApiKeyAccessRules): Record<string, unknown> {
  const entries = Object.entries(rules)
    .map(([key, rule]) => [key.trim(), rule] as const)
    .filter(([key]) => key.length > 0);

  const serialized: Record<string, unknown> = {};
  entries.forEach(([key, rule]) => {
    if (rule.access === 'all') {
      serialized[key] = { access: 'all' };
      return;
    }
    const value: Record<string, unknown> = {};
    const providers = normalizeStringList(rule.providers, true);
    const providerTargets = normalizeApiKeyAccessProviderTargets(rule.providerTargets);
    const authFiles = normalizeStringList(rule.authFiles, false);
    if (providers.length > 0) value.providers = providers;
    if (providerTargets.length > 0) {
      value['provider-targets'] = providerTargets.map((target) => ({
        provider: target.provider,
        'base-url': target.baseUrl,
      }));
    }
    if (authFiles.length > 0) value['auth-files'] = authFiles;
    serialized[key] = value;
  });

  return serialized;
}
