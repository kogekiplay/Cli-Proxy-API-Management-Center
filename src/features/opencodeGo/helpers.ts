import type { OpenCodeGoAccount } from '@/types/opencodeGo';

export const displayOpenCodeGoAccountName = (account: OpenCodeGoAccount) =>
  account.alias || account.email || account.username || account.workspaceId || account.id;

export const resolveOpenCodeGoManagementBase = (apiBase: string, managementBase: string) => {
  const configured = managementBase.trim();
  if (/^https?:\/\//i.test(configured)) {
    return configured.replace(/\/+$/, '');
  }

  const base = (apiBase || window.location.origin).replace(/\/+$/, '');
  const path = configured || '/v0/management';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`.replace(/\/+$/, '');
};
