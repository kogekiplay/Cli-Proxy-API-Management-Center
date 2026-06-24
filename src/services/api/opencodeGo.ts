import { apiClient } from './client';
import type {
  OpenCodeGoAccount,
  OpenCodeGoAccountsResponse,
  OpenCodeGoUsageSnapshot,
  OpenCodeGoUsageWindow,
  OpenCodeGoUserscriptConfig,
} from '@/types/opencodeGo';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const readString = (record: Record<string, unknown>, key: string): string | undefined => {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const readNumber = (record: Record<string, unknown>, key: string): number | undefined => {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const normalizeUsageWindow = (raw: unknown): OpenCodeGoUsageWindow | undefined => {
  if (!isRecord(raw)) return undefined;
  const window = {
    used: readNumber(raw, 'used'),
    limit: readNumber(raw, 'limit'),
    resetAt: readString(raw, 'reset-at'),
  };
  return window.used === undefined && window.limit === undefined && !window.resetAt ? undefined : window;
};

const normalizeUsage = (raw: unknown): OpenCodeGoUsageSnapshot | undefined => {
  if (!isRecord(raw)) return undefined;
  const usage = {
    rolling: normalizeUsageWindow(raw.rolling),
    weekly: normalizeUsageWindow(raw.weekly),
    monthly: normalizeUsageWindow(raw.monthly),
  };
  return usage.rolling || usage.weekly || usage.monthly ? usage : undefined;
};

const normalizeAccount = (raw: unknown): OpenCodeGoAccount | null => {
  if (!isRecord(raw)) return null;
  const id = readString(raw, 'id');
  if (!id) return null;
  return {
    id,
    alias: readString(raw, 'alias'),
    email: readString(raw, 'email'),
    username: readString(raw, 'username'),
    workspaceId: readString(raw, 'workspace-id'),
    apiKeyPreview: readString(raw, 'api-key-preview'),
    hasApiKey: Boolean(raw['has-api-key']),
    hasCookie: Boolean(raw['has-cookie']),
    usage: normalizeUsage(raw.usage),
    providerName: readString(raw, 'provider-name'),
    baseUrl: readString(raw, 'base-url'),
    apiKeySynced: Boolean(raw['api-key-synced']),
    providerKeyManaged: Boolean(raw['provider-key-managed']),
    providerSyncedAt: readString(raw, 'provider-synced-at'),
    providerSyncError: readString(raw, 'provider-sync-error'),
    createdAt: readString(raw, 'created-at'),
    updatedAt: readString(raw, 'updated-at'),
    lastSyncedAt: readString(raw, 'last-synced-at'),
  };
};

export const opencodeGoApi = {
  async list(): Promise<OpenCodeGoAccountsResponse> {
    const data = await apiClient.get<Record<string, unknown>>('/opencode-go/accounts');
    const accountsRaw = Array.isArray(data.accounts) ? data.accounts : [];
    return {
      providerName: readString(data, 'provider-name') ?? 'opencode-go',
      baseUrl: readString(data, 'base-url') ?? '',
      accounts: accountsRaw.map(normalizeAccount).filter(Boolean) as OpenCodeGoAccount[],
    };
  },

  async syncProvider(id: string): Promise<{ account: OpenCodeGoAccount | null }> {
    const data = await apiClient.post<Record<string, unknown>>(
      `/opencode-go/accounts/${encodeURIComponent(id)}/sync-provider`
    );
    return { account: normalizeAccount(data.account) };
  },

  deleteAccount(id: string, removeProviderKey: boolean): Promise<{ deleted: boolean }> {
    return apiClient.delete(
      `/opencode-go/accounts/${encodeURIComponent(id)}?remove-provider-key=${removeProviderKey ? 'true' : 'false'}`
    );
  },

  async userscriptConfig(): Promise<OpenCodeGoUserscriptConfig> {
    const data = await apiClient.get<Record<string, unknown>>('/opencode-go/userscript-config');
    return {
      name: readString(data, 'name') ?? 'opencode go账号助手',
      match: readString(data, 'match') ?? 'https://opencode.ai/*',
      managementBase: readString(data, 'management-base') ?? '/v0/management',
      endpoints: isRecord(data.endpoints)
        ? Object.fromEntries(
            Object.entries(data.endpoints).flatMap(([key, value]) =>
              typeof value === 'string' ? [[key, value]] : []
            )
          )
        : {},
    };
  },
};
