export function maskUsageAnalyticsClientAPIKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'API Key';
  const visiblePrefix = trimmed.slice(0, Math.min(7, trimmed.length));
  const visibleSuffix = trimmed.length > 11 ? trimmed.slice(-4) : '';
  return `${visiblePrefix}${visibleSuffix ? `...${visibleSuffix}` : ''}`;
}

interface UsageAnalyticsAPIKeyDisplayRow {
  provider?: string | null;
  auth_type?: string | null;
  api_key_hash?: string | null;
  credential_key_hash?: string | null;
  account_ref?: string | null;
}

interface UsageAnalyticsAPIKeyDisplayAccount {
  apiKeyPreview?: string | null;
}

interface UsageAnalyticsAPIKeyDisplayOptions {
  clientAPIKeyLabelByHash?: Map<string, string>;
  opencodeAccountsByID?: Map<string, UsageAnalyticsAPIKeyDisplayAccount>;
}

const clean = (value: string | null | undefined): string => value?.trim() ?? '';

const accountIdFromRef = (value: string | null | undefined): string => {
  const trimmed = clean(value);
  if (!trimmed) return '';
  return trimmed.startsWith('opencode-go:') ? trimmed.slice('opencode-go:'.length) : trimmed;
};

const isOpenCodeGoEvent = (row: UsageAnalyticsAPIKeyDisplayRow): boolean => {
  const provider = clean(row.provider).toLowerCase();
  const accountRef = clean(row.account_ref).toLowerCase();
  return provider.includes('opencode-go') || accountRef.startsWith('opencode-go:');
};

export function resolveUsageAnalyticsAPIKeyDisplay(
  row: UsageAnalyticsAPIKeyDisplayRow,
  options: UsageAnalyticsAPIKeyDisplayOptions = {}
): { labelKey: 'usage_analytics.api_key' | 'usage_analytics.api_key_hash'; value: string } {
  const callerHash = clean(row.api_key_hash);
  const credentialHash = clean(row.credential_key_hash);

  if (isOpenCodeGoEvent(row)) {
    const accountID = accountIdFromRef(row.account_ref);
    const account = accountID ? options.opencodeAccountsByID?.get(accountID) : undefined;
    const preview = clean(account?.apiKeyPreview);
    if (preview) {
      return { labelKey: 'usage_analytics.api_key', value: preview };
    }
    return {
      labelKey: 'usage_analytics.api_key_hash',
      value: credentialHash || callerHash || '-',
    };
  }

  const callerPreview = callerHash ? options.clientAPIKeyLabelByHash?.get(callerHash) : '';
  if (callerPreview) {
    return { labelKey: 'usage_analytics.api_key', value: callerPreview };
  }

  return {
    labelKey: 'usage_analytics.api_key_hash',
    value: callerHash || credentialHash || '-',
  };
}
