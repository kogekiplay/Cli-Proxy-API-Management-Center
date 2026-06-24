import { describe, expect, test } from 'bun:test';
import type { OpenCodeGoAccount } from '../src/types/opencodeGo';
import { refreshOpenCodeGoUsageConcurrently } from '../src/features/opencodeGo/refreshUsagePool';

const account = (id: string): OpenCodeGoAccount =>
  ({
    id,
    hasCookie: true,
  }) as OpenCodeGoAccount;

describe('OpenCode Go usage refresh pool', () => {
  test('refreshes accounts with bounded concurrency', async () => {
    let active = 0;
    let maxActive = 0;
    const refreshed: string[] = [];

    const result = await refreshOpenCodeGoUsageConcurrently(
      [account('a'), account('b'), account('c'), account('d'), account('e')],
      async (item) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await Bun.sleep(10);
        active -= 1;
        return { account: { ...item, apiKeyPreview: item.id } };
      },
      (item) => refreshed.push(item.id),
      { concurrency: 2, fallbackErrorMessage: 'refresh failed' }
    );

    expect(result).toEqual({ successCount: 5, firstError: '' });
    expect(maxActive).toBe(2);
    expect(refreshed.sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});
