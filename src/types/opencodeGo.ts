export interface OpenCodeGoUsageWindow {
  used?: number;
  limit?: number;
  resetAt?: string;
}

export interface OpenCodeGoUsageSnapshot {
  rolling?: OpenCodeGoUsageWindow;
  weekly?: OpenCodeGoUsageWindow;
  monthly?: OpenCodeGoUsageWindow;
}

export interface OpenCodeGoAccount {
  id: string;
  alias?: string;
  email?: string;
  username?: string;
  workspaceId?: string;
  apiKeyPreview?: string;
  hasApiKey: boolean;
  hasCookie: boolean;
  usage?: OpenCodeGoUsageSnapshot;
  providerName?: string;
  baseUrl?: string;
  apiKeySynced: boolean;
  providerKeyManaged: boolean;
  providerSyncedAt?: string;
  providerSyncError?: string;
  createdAt?: string;
  updatedAt?: string;
  lastSyncedAt?: string;
}

export interface OpenCodeGoAccountsResponse {
  providerName: string;
  baseUrl: string;
  accounts: OpenCodeGoAccount[];
}

export interface OpenCodeGoUserscriptConfig {
  name: string;
  match: string;
  managementBase: string;
  endpoints: Record<string, string>;
}
