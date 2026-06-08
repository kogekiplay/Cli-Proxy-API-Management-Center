import { describe, expect, test } from 'bun:test';
import {
  getApiKeyAccessAuthFileTargetsForPicker,
  getApiKeyAccessAuthTargetBaseUrl,
  getApiKeyAccessAuthTargetLabel,
  getApiKeyAccessAuthTargetValue,
  getApiKeyAccessProviderTargetsForPicker,
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

  test('uses configured provider targets without mixing auth target defaults', () => {
    const providerTargets = getApiKeyAccessProviderTargetsForPicker(
      [
        { provider: 'codex', 'base-url': 'https://aigw.c5y.moe/v1' },
        { provider: 'codex', base_url: 'https://muyuan.do/v1' },
      ],
      [
        {
          id: 'codex-oauth-default',
          provider: 'codex',
          filename: 'codex-oauth-default.json',
          provider_target: { provider: 'codex', base_url: '' },
        },
      ]
    );

    expect(providerTargets).toEqual([
      { provider: 'codex', baseUrl: 'https://aigw.c5y.moe/v1' },
      { provider: 'codex', baseUrl: 'https://muyuan.do/v1' },
    ]);
  });

  test('honors an explicitly empty configured provider target list', () => {
    const providerTargets = getApiKeyAccessProviderTargetsForPicker(
      [],
      [
        {
          id: 'codex-runtime',
          provider: 'codex',
          filename: 'codex-runtime.json',
          provider_target: {
            provider: 'codex',
            base_url: 'https://chatgpt.com/backend-api/codex',
          },
        },
      ]
    );

    expect(providerTargets).toEqual([]);
  });

  test('filters api key credentials from auth file picker targets', () => {
    const authTargets = getApiKeyAccessAuthFileTargetsForPicker([
      {
        id: 'claude-apikey-1',
        provider: 'claude',
        name: 'claude-apikey',
        account_type: 'api_key',
      },
      {
        id: 'codex-user',
        provider: 'codex',
        filename: 'codex-user.json',
        account_type: 'oauth',
      },
    ]);

    expect(authTargets.map((target) => target.id)).toEqual(['codex-user']);
  });
});
