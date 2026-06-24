import type { OpenCodeGoAccount } from '@/types/opencodeGo';

export const OPEN_CODE_GO_REFRESH_CONCURRENCY = 6;

type RefreshUsageResult = {
  account: OpenCodeGoAccount | null;
};

interface RefreshOpenCodeGoUsageOptions {
  concurrency?: number;
  fallbackErrorMessage: string;
}

interface RefreshOpenCodeGoUsageSummary {
  successCount: number;
  firstError: string;
}

export async function refreshOpenCodeGoUsageConcurrently(
  accounts: OpenCodeGoAccount[],
  refreshUsage: (account: OpenCodeGoAccount) => Promise<RefreshUsageResult>,
  onAccountRefreshed: (account: OpenCodeGoAccount) => void,
  options: RefreshOpenCodeGoUsageOptions
): Promise<RefreshOpenCodeGoUsageSummary> {
  const workerCount = Math.max(
    1,
    Math.min(options.concurrency ?? OPEN_CODE_GO_REFRESH_CONCURRENCY, accounts.length)
  );
  let nextIndex = 0;
  let successCount = 0;
  let firstError = '';

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < accounts.length) {
        const account = accounts[nextIndex];
        nextIndex += 1;

        try {
          const result = await refreshUsage(account);
          if (result.account) {
            onAccountRefreshed(result.account);
          }
          successCount += 1;
        } catch (error) {
          if (!firstError) {
            firstError = error instanceof Error ? error.message : options.fallbackErrorMessage;
          }
        }
      }
    })
  );

  return { successCount, firstError };
}
