import { describe, expect, test } from 'bun:test';
import { hashAPIKeyForUsage } from '../src/utils/usageApiKeyHash';

describe('usage API key hash', () => {
  test('matches the backend SHA-256 hash and trims configured keys', async () => {
    expect(await hashAPIKeyForUsage(' abc ')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  test('returns an empty hash for blank keys', async () => {
    expect(await hashAPIKeyForUsage('   ')).toBe('');
  });
});
