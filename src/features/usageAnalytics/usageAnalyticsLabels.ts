export function maskUsageAnalyticsClientAPIKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'API Key';
  const visiblePrefix = trimmed.slice(0, Math.min(7, trimmed.length));
  const visibleSuffix = trimmed.length > 11 ? trimmed.slice(-4) : '';
  return `${visiblePrefix}${visibleSuffix ? `...${visibleSuffix}` : ''}`;
}
