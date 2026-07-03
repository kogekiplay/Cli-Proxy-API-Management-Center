import { describe, expect, test } from 'bun:test';
import {
  canonicalApiKeyAccessRules,
  parseApiKeyAccessRules,
  pruneApiKeyAccessRules,
  serializeApiKeyAccessRules,
} from '../src/utils/apiKeyAccessRules';

describe('api key access rules', () => {
  test('parses and canonicalizes provider targets', () => {
    const rules = parseApiKeyAccessRules({
      ' key-limited ': {
        providers: [' Claude ', 'claude'],
        'provider-targets': [
          { provider: ' Claude ', 'base-url': ' https://a.example.com ' },
          { provider: 'claude', 'base-url': 'https://a.example.com' },
          { provider: 'Claude', baseUrl: 'https://b.example.com' },
          { provider: 'codex', base_url: '' },
          { provider: '', 'base-url': 'https://ignored.example.com' },
        ],
        'auth-files': [' claude-a.json ', 'claude-a.json'],
      },
    });

    expect(rules).toEqual({
      'key-limited': {
        providers: ['claude'],
        providerTargets: [
          { provider: 'claude', baseUrl: 'https://a.example.com' },
          { provider: 'claude', baseUrl: 'https://b.example.com' },
          { provider: 'codex', baseUrl: '' },
        ],
        authFiles: ['claude-a.json'],
      },
    });

    expect(canonicalApiKeyAccessRules(rules)).toEqual({
      'key-limited': {
        providers: ['claude'],
        providerTargets: [
          { provider: 'claude', baseUrl: 'https://a.example.com' },
          { provider: 'claude', baseUrl: 'https://b.example.com' },
          { provider: 'codex', baseUrl: '' },
        ],
        authFiles: ['claude-a.json'],
      },
    });
  });

  test('serializes provider targets with yaml key names', () => {
    const serialized = serializeApiKeyAccessRules({
      'key-limited': {
        providerTargets: [
          { provider: ' Claude ', baseUrl: ' https://a.example.com ' },
          { provider: 'claude', baseUrl: 'https://a.example.com' },
        ],
        authFiles: [' claude-a.json '],
      },
      'key-all': {
        access: 'all',
        providerTargets: [{ provider: 'claude', baseUrl: 'https://ignored.example.com' }],
        authFiles: ['ignored.json'],
      },
    });

    expect(serialized).toEqual({
      'key-limited': {
        'provider-targets': [{ provider: 'claude', 'base-url': 'https://a.example.com' }],
        'auth-files': ['claude-a.json'],
      },
      'key-all': { access: 'all' },
    });
  });

  test('prunes deleted provider targets and auth files before saving access rules', () => {
    const pruned = pruneApiKeyAccessRules(
      {
        'key-limited': {
          providerTargets: [
            { provider: 'codex', baseUrl: 'https://alive.example.com/v1' },
            { provider: 'codex', baseUrl: 'https://deleted.example.com/v1' },
          ],
          authFiles: ['codex-alive.json', 'codex-deleted.json'],
        },
        'key-deny-after-delete': {
          providerTargets: [{ provider: 'xai', baseUrl: 'https://deleted.example.com/v1' }],
          authFiles: ['xai-deleted.json'],
        },
        'key-all': {
          access: 'all',
          providerTargets: [{ provider: 'codex', baseUrl: 'https://deleted.example.com/v1' }],
          authFiles: ['codex-deleted.json'],
        },
      },
      {
        providerTargets: [{ provider: ' codex ', baseUrl: ' https://alive.example.com/v1 ' }],
        authFiles: [' codex-alive.json '],
      }
    );

    expect(pruned).toEqual({
      'key-limited': {
        providerTargets: [{ provider: 'codex', baseUrl: 'https://alive.example.com/v1' }],
        authFiles: ['codex-alive.json'],
      },
      'key-deny-after-delete': {},
      'key-all': { access: 'all' },
    });
  });
});
