import { describe, expect, test } from 'bun:test';
import { resolveUsageAnalyticsAPIKeyDisplay } from '../src/features/usageAnalytics/usageAnalyticsLabels';

describe('usage analytics API key display', () => {
  test('uses OpenCode Go API key preview for OpenCode account events', () => {
    const display = resolveUsageAnalyticsAPIKeyDisplay(
      {
        provider: 'openai-compatible-opencode-go',
        auth_type: 'apikey',
        api_key_hash: 'caller-hash',
        credential_key_hash: 'provider-key-hash',
        account_ref: 'opencode-go:opencode_go_test_account',
      },
      {
        opencodeAccountsByID: new Map([
          [
            'opencode_go_test_account',
            {
              apiKeyPreview: 'sk-test...0001',
            },
          ],
        ]),
      }
    );

    expect(display.labelKey).toBe('usage_analytics.api_key');
    expect(display.value).toBe('sk-test...0001');
  });

  test('falls back to the credential key hash before the caller key hash', () => {
    const display = resolveUsageAnalyticsAPIKeyDisplay(
      {
        provider: 'openai-compatible-opencode-go',
        auth_type: 'apikey',
        api_key_hash: 'caller-hash',
        credential_key_hash: 'provider-key-hash',
        account_ref: 'opencode-go:missing_account',
      },
      {
        opencodeAccountsByID: new Map(),
      }
    );

    expect(display.labelKey).toBe('usage_analytics.api_key_hash');
    expect(display.value).toBe('provider-key-hash');
  });

  test('uses known caller API key labels for non-provider-key events', () => {
    const display = resolveUsageAnalyticsAPIKeyDisplay(
      {
        provider: 'codex',
        auth_type: 'oauth',
        api_key_hash: 'caller-hash',
      },
      {
        clientAPIKeyLabelByHash: new Map([['caller-hash', 'sk-test...caller']]),
      }
    );

    expect(display.labelKey).toBe('usage_analytics.api_key');
    expect(display.value).toBe('sk-test...caller');
  });
});
