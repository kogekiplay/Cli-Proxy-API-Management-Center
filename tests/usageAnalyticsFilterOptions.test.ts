import { describe, expect, test } from 'bun:test';
import {
  buildUsageAPIKeyOptions,
  buildUsageAuthIndexOptions,
  buildUsageModelOptions,
  buildPublicUsageAPIKeySources,
  buildPublicUsageAuthFileSources,
  buildUsageProviderOptions,
  type UsageFilterSelection,
  type UsageFilterSource,
} from '../src/features/usageAnalytics/usageAnalyticsFilterOptions';

const optionValues = (options: Array<{ value: string }>) => options.map((option) => option.value);
const optionLabels = (options: Array<{ label: string }>) => options.map((option) => option.label);

const rows: UsageFilterSource[] = [
  {
    provider: 'codex',
    model: 'gpt-5.5',
    authIndex: 'codex-q',
    apiKeyHash: 'hash-key-1',
  },
  {
    provider: 'codex',
    model: 'gpt-5.3-codex-spark',
    authIndex: 'codex-q',
    apiKeyHash: 'hash-key-1',
  },
  {
    provider: 'openai-compatible-opencode-go',
    model: 'opencode/go',
    authIndex: 'opencode-provider-key-1',
    apiKeyHash: 'hash-key-2',
  },
  {
    provider: 'openai-compatible-opencode-go',
    model: 'opencode/go',
    authIndex: 'opencode-provider-key-2',
    authLabel: 'w981612327@gmail.com',
    apiKeyHash: 'hash-key-2',
  },
  {
    provider: 'anthropic',
    model: 'claude-sonnet-4',
    authIndex: 'claude-q',
    apiKeyHash: 'hash-key-3',
  },
];

const configuredAPIKeys = [
  { value: 'hash-key-1', label: 'sk-test...0001' },
  { value: 'hash-key-2', label: 'sk-test...0002' },
  { value: 'hash-key-3', label: 'sk-test...0003' },
  { value: 'hash-key-4', label: 'sk-test...0004' },
];

const authFiles = [
  { provider: 'codex', authIndex: 'codex-q', label: 'q981612327@outlook.com' },
  { provider: 'codex', authIndex: 'codex-w', label: 'w981612327@gmail.com' },
  { provider: 'anthropic', authIndex: 'claude-q', label: 'Claude q981612327' },
];

describe('usage analytics filter options', () => {
  test('builds guest credential choices from redacted analytics stats', () => {
    const publicAuthFiles = buildPublicUsageAuthFileSources([
      {
        provider: 'codex',
        auth_index: 'public-codex-q',
        credential_display_name: 'q***@outlook.com',
      },
    ]);
    const options = buildUsageAuthIndexOptions({
      allLabel: '全部认证文件',
      authFiles: publicAuthFiles,
      selection: {},
      usageRows: [
        { provider: 'codex', authIndex: 'public-codex-q', authLabel: 'q***@outlook.com' },
      ],
    });

    expect(optionValues(options)).toEqual(['', 'public-codex-q']);
    expect(optionLabels(options)).toEqual(['全部认证文件', 'q***@outlook.com']);
  });

  test('builds guest API key choices from masked analytics previews', () => {
    const publicAPIKeys = buildPublicUsageAPIKeySources([
      { api_key_hash: 'hash-public-key-1', api_key_preview: 'sk-test...0001' },
    ]);
    const options = buildUsageAPIKeyOptions({
      allLabel: '全部 API Key',
      configuredAPIKeys: publicAPIKeys,
      selection: {},
      usageRows: [{ provider: 'codex', apiKeyHash: 'hash-public-key-1' }],
    });

    expect(optionValues(options)).toEqual(['', 'hash-public-key-1']);
    expect(optionLabels(options)).toEqual(['全部 API Key', 'sk-test...0001']);
  });

  test('scopes API key choices to the selected provider instead of showing every configured key', () => {
    const options = buildUsageAPIKeyOptions({
      allLabel: '全部 API Key',
      configuredAPIKeys,
      selection: { provider: 'codex' },
      usageRows: rows,
    });

    expect(optionValues(options)).toEqual(['', 'hash-key-1']);
    expect(optionLabels(options)).toEqual(['全部 API Key', 'sk-test...0001']);
  });

  test('keeps API key choices scoped by provider and model together', () => {
    const selection: UsageFilterSelection = {
      provider: 'codex',
      model: 'gpt-5.3-codex-spark',
    };

    const options = buildUsageAPIKeyOptions({
      allLabel: '全部 API Key',
      configuredAPIKeys,
      selection,
      usageRows: rows,
    });

    expect(optionValues(options)).toEqual(['', 'hash-key-1']);
  });

  test('scopes API key choices to an OpenAI-compatible provider without leaking other keys', () => {
    const options = buildUsageAPIKeyOptions({
      allLabel: '全部 API Key',
      configuredAPIKeys,
      selection: { provider: 'openai-compatible-opencode-go' },
      usageRows: rows,
    });

    expect(optionValues(options)).toEqual(['', 'hash-key-2']);
  });

  test('shows all configured API keys only when no contextual filter is active', () => {
    const options = buildUsageAPIKeyOptions({
      allLabel: '全部 API Key',
      configuredAPIKeys,
      selection: {},
      usageRows: rows,
    });

    expect(optionValues(options)).toEqual([
      '',
      'hash-key-1',
      'hash-key-2',
      'hash-key-3',
      'hash-key-4',
    ]);
  });

  test('builds credential choices from configured auth files only', () => {
    const options = buildUsageAuthIndexOptions({
      allLabel: '全部认证文件',
      authFiles,
      selection: { provider: 'openai-compatible-opencode-go' },
      usageRows: rows,
    });

    expect(optionValues(options)).toEqual(['']);
    expect(optionLabels(options)).not.toContain('opencode-go');
    expect(optionLabels(options)).not.toContain('w981612327@gmail.com');
  });

  test('scopes credential choices by auth-file provider', () => {
    const options = buildUsageAuthIndexOptions({
      allLabel: '全部认证文件',
      authFiles,
      selection: { provider: 'codex' },
      usageRows: rows,
    });

    expect(optionValues(options)).toEqual(['', 'codex-q', 'codex-w']);
    expect(optionLabels(options)).toEqual([
      '全部认证文件',
      'q981612327@outlook.com',
      'w981612327@gmail.com',
    ]);
  });

  test('scopes credential choices by provider and API key usage together', () => {
    const options = buildUsageAuthIndexOptions({
      allLabel: '全部认证文件',
      authFiles,
      selection: { provider: 'codex', apiKeyHash: 'hash-key-1' },
      usageRows: rows,
    });

    expect(optionValues(options)).toEqual(['', 'codex-q']);
  });

  test('does not leak credentials for an impossible provider and API key combination', () => {
    const options = buildUsageAuthIndexOptions({
      allLabel: '全部认证文件',
      authFiles,
      selection: { provider: 'codex', apiKeyHash: 'hash-key-2' },
      usageRows: rows,
    });

    expect(optionValues(options)).toEqual(['']);
  });

  test('scopes model choices by provider and API key context', () => {
    const options = buildUsageModelOptions({
      allLabel: '全部模型',
      selectedValue: '',
      selection: { provider: 'openai-compatible-opencode-go', apiKeyHash: 'hash-key-2' },
      usageRows: rows,
    });

    expect(optionValues(options)).toEqual(['', 'opencode/go']);
  });

  test('scopes provider choices by the selected API key', () => {
    const options = buildUsageProviderOptions({
      allLabel: '全部 Provider',
      selectedValue: '',
      selection: { apiKeyHash: 'hash-key-2' },
      usageRows: rows,
    });

    expect(optionValues(options)).toEqual(['', 'openai-compatible-opencode-go']);
  });

  test('preserves the selected value when the latest option payload no longer contains it', () => {
    const options = buildUsageAPIKeyOptions({
      allLabel: '全部 API Key',
      configuredAPIKeys,
      selectedValue: 'hash-key-missing',
      selection: { provider: 'codex' },
      usageRows: rows,
    });

    expect(options[0]?.value).toBe('');
    expect(optionValues(options)).toContain('hash-key-1');
    expect(optionValues(options)).toContain('hash-key-missing');
  });
});
