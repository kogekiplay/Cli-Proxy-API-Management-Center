export const MONITORING_COLUMN_WIDTHS = [8, 11, 10, 9, 6, 10, 6, 12, 15, 9, 4] as const;

export type ReasoningEffortTone = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export const monitoringProviderLabel = (
  value?: string | null,
  authType?: string | null
) => {
  const provider = value?.trim() ?? '';
  const prefix = 'openai-compatible-';
  if (provider.toLowerCase().startsWith(prefix)) return provider.slice(prefix.length) || 'Unknown';
  if (provider === 'opencode-go') return 'OpenCode';
  if (provider === 'codex') {
    const normalizedAuthType = authType?.trim().toLowerCase() ?? '';
    if (normalizedAuthType === 'oauth' || normalizedAuthType === 'oauth2') return 'Codex OAuth';
    if (['apikey', 'api_key', 'api-key'].includes(normalizedAuthType)) return 'Codex API Key';
    return 'Codex';
  }
  return provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : 'Unknown';
};

export const formatReasoningEffort = (value?: string | null) => {
  const normalized = value?.trim().toLowerCase() ?? '';
  return normalized === 'ultra' ? 'max' : normalized || '-';
};

export const reasoningEffortTone = (value?: string | null): ReasoningEffortTone => {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (normalized === 'minimal' || normalized === 'low') return 'low';
  if (normalized === 'medium') return 'medium';
  if (normalized === 'high') return 'high';
  if (normalized === 'xhigh') return 'xhigh';
  if (normalized === 'max' || normalized === 'ultra') return 'max';
  return 'none';
};
