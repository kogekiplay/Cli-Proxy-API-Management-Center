export const MONITORING_COLUMN_WIDTHS = [8, 12, 8, 10, 6, 10, 6, 12, 15, 9, 4] as const;

export const monitoringProviderLabel = (value?: string | null) => {
  const provider = value?.trim() ?? '';
  const prefix = 'openai-compatible-';
  if (provider.toLowerCase().startsWith(prefix)) return provider.slice(prefix.length) || 'Unknown';
  if (provider === 'opencode-go') return 'OpenCode';
  if (provider === 'codex') return 'Codex';
  return provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : 'Unknown';
};

export const formatReasoningEffort = (value?: string | null) => {
  const normalized = value?.trim().toLowerCase() ?? '';
  return normalized || '-';
};
