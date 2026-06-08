import { describe, expect, test } from 'bun:test';
import {
  getApiKeyAccessAuthTargetBaseUrl,
  getApiKeyAccessAuthTargetLabel,
  getApiKeyAccessAuthTargetValue,
} from '../src/utils/apiKeyAccessTargets';

describe('api key access auth targets', () => {
  test('falls back past empty filename values', () => {
    const target = {
      id: 'runtime-auth-id',
      provider: 'claude',
      filename: '',
      name: 'claude-auth.json',
      label: '',
      email: 'user@example.com',
    };

    expect(getApiKeyAccessAuthTargetValue(target)).toBe('claude-auth.json');
    expect(getApiKeyAccessAuthTargetLabel(target)).toBe('claude / user@example.com');
  });

  test('reads base url from nested provider target metadata', () => {
    expect(
      getApiKeyAccessAuthTargetBaseUrl({
        id: 'auth-id',
        provider: 'codex',
        provider_target: {
          provider: 'codex',
          base_url: ' https://aigw.c5y.moe/v1 ',
        },
      })
    ).toBe('https://aigw.c5y.moe/v1');
  });
});
