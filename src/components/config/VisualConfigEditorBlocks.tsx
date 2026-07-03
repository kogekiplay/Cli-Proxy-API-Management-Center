import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { SelectionCheckbox } from '@/components/ui/SelectionCheckbox';
import { IconSearch } from '@/components/ui/icons';
import { useNotificationStore } from '@/stores';
import styles from './VisualConfigEditor.module.scss';
import { copyToClipboard } from '@/utils/clipboard';
import type {
  PayloadFilterRule,
  PayloadHeaderEntry,
  PayloadModelEntry,
  PayloadParamEntry,
  PayloadParamValidationErrorCode,
  PayloadParamValueType,
  PayloadRule,
  PluginStoreAuthApplyTo,
  PluginStoreAuthRule,
  PluginStoreAuthType,
} from '@/types/visualConfig';
import type { ApiKeyAccessRule, ApiKeyAccessRules } from '@/types/config';
import type { ApiKeyAccessAuthTarget, ApiKeyAccessProviderTargetResponse } from '@/services/api';
import { makeClientId } from '@/types/visualConfig';
import {
  getPayloadParamValidationError,
  VISUAL_CONFIG_PAYLOAD_VALUE_TYPE_OPTIONS,
  VISUAL_CONFIG_PROTOCOL_OPTIONS,
} from '@/hooks/useVisualConfig';
import { maskApiKey } from '@/utils/format';
import { isValidApiKeyCharset } from '@/utils/validation';
import type { ApiKeyAccessProviderTarget } from '@/types/config';
import { areApiKeyAccessRulesEqual, pruneApiKeyAccessRules } from '@/utils/apiKeyAccessRules';
import {
  getApiKeyAccessAuthFileTargetsForPicker,
  getApiKeyAccessAuthTargetLabel,
  getApiKeyAccessAuthTargetValue,
  getApiKeyAccessProviderTargetsForPicker,
} from '@/utils/apiKeyAccessTargets';

/** Minimum character count before the expand/collapse toggle appears. */
const EXPAND_THRESHOLD = 30;

type ApiKeyAccessListField = 'providerTargets' | 'authFiles';

interface AccessPickerOption {
  value: string;
  label: string;
  description?: string;
}

const DEFAULT_PROVIDER_BASE_URLS: Record<string, string> = {
  claude: 'https://api.anthropic.com',
  codex: 'https://chatgpt.com/backend-api/codex',
  vertex: 'https://aiplatform.googleapis.com',
  xai: 'https://api.x.ai/v1',
};

function readApiKeyAccessRule(
  rules: ApiKeyAccessRules | undefined,
  apiKey: string
): ApiKeyAccessRule | undefined {
  const trimmed = apiKey.trim();
  if (!rules || !trimmed) return undefined;
  return rules[apiKey] ?? rules[trimmed];
}

function providerTargetValue(target: ApiKeyAccessProviderTarget): string {
  return `${target.provider.trim().toLowerCase()}\u0000${target.baseUrl.trim()}`;
}

function providerTargetFromValue(value: string): ApiKeyAccessProviderTarget | null {
  const [provider = '', baseUrl = ''] = value.split('\u0000');
  const normalizedProvider = provider.trim().toLowerCase();
  if (!normalizedProvider) return null;
  return { provider: normalizedProvider, baseUrl: baseUrl.trim() };
}

function providerTargetLabelFromValue(value: string, defaultBaseUrlLabel: string): string {
  const target = providerTargetFromValue(value);
  if (!target) return value;
  return `${target.provider} / ${
    target.baseUrl ||
    (DEFAULT_PROVIDER_BASE_URLS[target.provider]
      ? `${defaultBaseUrlLabel} ${DEFAULT_PROVIDER_BASE_URLS[target.provider]}`
      : defaultBaseUrlLabel)
  }`;
}

function providerTargetValuesForRule(
  rule: ApiKeyAccessRule | undefined,
  options: AccessPickerOption[]
): string[] {
  if (!rule || rule.access === 'all') return [];
  const selected = new Set<string>();
  (rule.providerTargets ?? []).forEach((target) => {
    const value = providerTargetValue(target);
    if (value) selected.add(value);
  });
  (rule.providers ?? []).forEach((provider) => {
    const normalizedProvider = provider.trim().toLowerCase();
    if (!normalizedProvider) return;
    options.forEach((option) => {
      const target = providerTargetFromValue(option.value);
      if (target?.provider === normalizedProvider) selected.add(option.value);
    });
  });
  return Array.from(selected);
}

function selectedOptionLabels(
  values: string[],
  options: AccessPickerOption[],
  formatMissingValue?: (value: string) => string
): string[] {
  const optionByValue = new Map(options.map((option) => [option.value, option]));
  return values.map(
    (value) => optionByValue.get(value)?.label ?? formatMissingValue?.(value) ?? value
  );
}

/** Auto-expanding textarea that collapses back to a single-line input on demand. */
function ExpandableInput({
  value,
  placeholder,
  ariaLabel,
  disabled,
  className,
  onChange,
}: {
  value: string;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  onChange: (nextValue: string) => void;
}) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Strip newlines — these fields are single-line identifiers/paths that
    // would break YAML serialization if they contained line breaks.
    const sanitized = e.target.value.replace(/[\r\n]/g, '');
    onChange(sanitized);
    // autoResize is handled by useLayoutEffect after React syncs the
    // sanitized value back to the DOM — calling it here would measure
    // stale content.
  };

  // Resize synchronously before paint to avoid visual flicker.
  useLayoutEffect(() => {
    if (!collapsed && textareaRef.current) {
      autoResize(textareaRef.current);
    }
  }, [collapsed, value, autoResize]);

  if (collapsed) {
    return (
      <div className={styles.expandableInputWrapper}>
        <input
          className={`input ${className ?? ''}`}
          placeholder={placeholder}
          aria-label={ariaLabel}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[\r\n]/g, ''))}
          disabled={disabled}
        />
        {value.length > EXPAND_THRESHOLD && (
          <button
            type="button"
            className={styles.expandableToggle}
            disabled={disabled}
            onClick={() => {
              setCollapsed(false);
              requestAnimationFrame(() => {
                textareaRef.current?.focus();
              });
            }}
            title={t('common.expand')}
            aria-label={t('common.expand')}
          >
            ▼
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`${styles.expandableInputWrapper} ${styles.expandableInputExpanded}`}>
      <textarea
        ref={textareaRef}
        className={`input ${styles.expandableTextarea} ${className ?? ''}`}
        placeholder={placeholder}
        aria-label={ariaLabel}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        rows={2}
      />
      <button
        type="button"
        className={styles.expandableToggle}
        disabled={disabled}
        onClick={() => setCollapsed(true)}
        title={t('common.collapse')}
        aria-label={t('common.collapse')}
      >
        ▲
      </button>
    </div>
  );
}

function getValidationMessage(
  t: ReturnType<typeof useTranslation>['t'],
  errorCode?: PayloadParamValidationErrorCode
) {
  if (!errorCode) return undefined;
  return t(`config_management.visual.validation.${errorCode}`);
}

function buildProtocolOptions(
  t: ReturnType<typeof useTranslation>['t'],
  rules: Array<{ models: PayloadModelEntry[] }>
) {
  const options: Array<{ value: string; label: string }> = VISUAL_CONFIG_PROTOCOL_OPTIONS.map(
    (option) => ({
      value: option.value,
      label: t(option.labelKey, { defaultValue: option.defaultLabel }),
    })
  );
  const seen = new Set<string>(options.map((option) => option.value));

  for (const rule of rules) {
    for (const model of rule.models) {
      const protocol = model.protocol;
      if (!protocol || !protocol.trim() || seen.has(protocol)) continue;
      seen.add(protocol);
      options.push({ value: protocol, label: protocol });
    }
  }

  return options;
}

export const ApiKeysCardEditor = memo(function ApiKeysCardEditor({
  value,
  apiKeyAccessRules = {},
  apiKeyAccessTargets = [],
  apiKeyAccessProviderTargets,
  apiKeyAccessMetadataReady = false,
  disabled,
  onChange,
  onApiKeyAccessChange,
}: {
  value: string;
  apiKeyAccessRules?: ApiKeyAccessRules;
  apiKeyAccessTargets?: ApiKeyAccessAuthTarget[];
  apiKeyAccessProviderTargets?: ApiKeyAccessProviderTargetResponse[];
  apiKeyAccessMetadataReady?: boolean;
  disabled?: boolean;
  onChange: (nextValue: string) => void;
  onApiKeyAccessChange?: (nextRules: ApiKeyAccessRules) => void;
}) {
  const { t } = useTranslation();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const apiKeys = useMemo(
    () =>
      value
        .split('\n')
        .map((key) => key.trim())
        .filter(Boolean),
    [value]
  );
  const [apiKeyIds, setApiKeyIds] = useState(() => apiKeys.map(() => makeClientId()));
  const renderApiKeyIds = useMemo(() => {
    if (apiKeyIds.length === apiKeys.length) return apiKeyIds;
    if (apiKeyIds.length > apiKeys.length) return apiKeyIds.slice(0, apiKeys.length);
    return [
      ...apiKeyIds,
      ...Array.from({ length: apiKeys.length - apiKeyIds.length }, () => makeClientId()),
    ];
  }, [apiKeyIds, apiKeys.length]);

  const apiKeyInputId = useId();
  const apiKeyHintId = `${apiKeyInputId}-hint`;
  const apiKeyErrorId = `${apiKeyInputId}-error`;
  const [modalOpen, setModalOpen] = useState(false);
  const [editingApiKeyId, setEditingApiKeyId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [formError, setFormError] = useState('');
  const accessEditingDisabled = disabled || !onApiKeyAccessChange;
  const accessOptions = useMemo(
    () => [
      { value: 'all', label: t('config_management.visual.api_keys.access_all') },
      { value: 'restricted', label: t('config_management.visual.api_keys.access_restricted') },
    ],
    [t]
  );
  const providerTargetOptions = useMemo<AccessPickerOption[]>(() => {
    const seen = new Set<string>();
    return getApiKeyAccessProviderTargetsForPicker(apiKeyAccessProviderTargets, apiKeyAccessTargets)
      .map((target) => {
        const provider = target.provider.trim().toLowerCase();
        const baseUrl = target.baseUrl.trim();
        const defaultBaseUrl = DEFAULT_PROVIDER_BASE_URLS[provider];
        const value = providerTargetValue({ provider, baseUrl });
        return {
          value,
          label: provider
            ? `${provider} / ${
                baseUrl ||
                (defaultBaseUrl
                  ? `${t('config_management.visual.api_keys.default_base_url')} ${defaultBaseUrl}`
                  : t('config_management.visual.api_keys.default_base_url'))
              }`
            : baseUrl,
        };
      })
      .filter((option) => {
        if (!option.value || seen.has(option.value)) return false;
        seen.add(option.value);
        return true;
      })
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [apiKeyAccessProviderTargets, apiKeyAccessTargets, t]);
	  const authFileOptions = useMemo<AccessPickerOption[]>(() => {
    const seen = new Set<string>();
    return getApiKeyAccessAuthFileTargetsForPicker(apiKeyAccessTargets)
      .map((target) => ({
        value: getApiKeyAccessAuthTargetValue(target),
        label: getApiKeyAccessAuthTargetLabel(target),
      }))
      .filter((target) => {
        if (!target.value || seen.has(target.value)) return false;
        seen.add(target.value);
        return true;
      })
      .sort((left, right) => left.label.localeCompare(right.label));
	  }, [apiKeyAccessTargets]);
  const availableAccessTargets = useMemo(
    () => ({
      providerTargets: providerTargetOptions
        .map((option) => providerTargetFromValue(option.value))
        .filter((target): target is ApiKeyAccessProviderTarget => Boolean(target)),
      authFiles: authFileOptions.map((option) => option.value),
    }),
    [authFileOptions, providerTargetOptions]
  );

  useEffect(() => {
    if (!apiKeyAccessMetadataReady || !onApiKeyAccessChange) return;
    const prunedRules = pruneApiKeyAccessRules(apiKeyAccessRules, availableAccessTargets);
    if (areApiKeyAccessRulesEqual(prunedRules, apiKeyAccessRules)) return;
    onApiKeyAccessChange(prunedRules);
  }, [
    apiKeyAccessMetadataReady,
    apiKeyAccessRules,
    availableAccessTargets,
    onApiKeyAccessChange,
  ]);

  function generateSecureApiKey(): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint8Array(17);
    crypto.getRandomValues(array);
    return 'sk-' + Array.from(array, (b) => charset[b % charset.length]).join('');
  }

  const openAddModal = () => {
    setEditingApiKeyId(null);
    setInputValue('');
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (apiKeyId: string) => {
    const editingIndex = renderApiKeyIds.findIndex((id) => id === apiKeyId);
    setEditingApiKeyId(apiKeyId);
    setInputValue(apiKeys[editingIndex] ?? '');
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setInputValue('');
    setEditingApiKeyId(null);
    setFormError('');
  };

  const updateApiKeys = (nextKeys: string[]) => {
    onChange(nextKeys.join('\n'));
  };

  const updateApiKeyAccessRules = (nextRules: ApiKeyAccessRules) => {
    onApiKeyAccessChange?.(nextRules);
  };

  const setAccessRule = (apiKey: string, rule: ApiKeyAccessRule) => {
    const key = apiKey.trim();
    if (!key) return;
    updateApiKeyAccessRules({
      ...apiKeyAccessRules,
      [key]: rule,
    });
  };

  const removeAccessRule = (apiKey: string) => {
    const trimmed = apiKey.trim();
    const nextRules = { ...apiKeyAccessRules };
    delete nextRules[apiKey];
    if (trimmed !== apiKey) delete nextRules[trimmed];
    updateApiKeyAccessRules(nextRules);
  };

  const renameAccessRule = (previousKey: string, nextKey: string) => {
    const previousTrimmed = previousKey.trim();
    const nextTrimmed = nextKey.trim();
    if (!previousTrimmed || !nextTrimmed || previousTrimmed === nextTrimmed) return;
    const previousRule = readApiKeyAccessRule(apiKeyAccessRules, previousKey);
    if (!previousRule) return;

    const nextRules = { ...apiKeyAccessRules };
    delete nextRules[previousKey];
    delete nextRules[previousTrimmed];
    nextRules[nextTrimmed] = previousRule;
    updateApiKeyAccessRules(nextRules);
  };

  const updateAccessMode = (apiKey: string, nextMode: string) => {
    if (nextMode === 'all') {
      setAccessRule(apiKey, { access: 'all' });
      return;
    }

    const currentRule = readApiKeyAccessRule(apiKeyAccessRules, apiKey);
    if (currentRule && currentRule.access !== 'all') {
      setAccessRule(apiKey, currentRule);
      return;
    }

    setAccessRule(apiKey, {
      providerTargets: providerTargetOptions
        .map((option) => providerTargetFromValue(option.value))
        .filter((target): target is ApiKeyAccessProviderTarget => Boolean(target)),
      authFiles: authFileOptions.map((option) => option.value),
    });
  };

  const updateRestrictedList = (
    apiKey: string,
    field: ApiKeyAccessListField,
    nextValues: string[]
  ) => {
    const currentRule = readApiKeyAccessRule(apiKeyAccessRules, apiKey);
    const nextRule: ApiKeyAccessRule =
      currentRule && currentRule.access !== 'all' ? { ...currentRule } : {};
    if (field === 'providerTargets') {
      nextRule.providerTargets = nextValues
        .map((value) => providerTargetFromValue(value))
        .filter((target): target is ApiKeyAccessProviderTarget => Boolean(target));
      delete nextRule.providers;
    } else {
      nextRule.authFiles = nextValues;
    }
    delete nextRule.access;
    setAccessRule(apiKey, nextRule);
  };

  const handleDelete = (apiKeyId: string) => {
    const index = renderApiKeyIds.findIndex((id) => id === apiKeyId);
    if (index < 0) return;
    const removedKey = apiKeys[index] ?? '';
    setApiKeyIds(renderApiKeyIds.filter((id) => id !== apiKeyId));
    updateApiKeys(apiKeys.filter((_, i) => i !== index));
    removeAccessRule(removedKey);
  };

  const handleSave = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setFormError(t('config_management.visual.api_keys.error_empty'));
      return;
    }
    if (!isValidApiKeyCharset(trimmed)) {
      setFormError(t('config_management.visual.api_keys.error_invalid'));
      return;
    }

    const editingIndex = editingApiKeyId
      ? renderApiKeyIds.findIndex((id) => id === editingApiKeyId)
      : -1;
    const nextKeys =
      editingApiKeyId === null
        ? [...apiKeys, trimmed]
        : apiKeys.map((key, idx) => (idx === editingIndex ? trimmed : key));
    const previousKey = editingIndex >= 0 ? (apiKeys[editingIndex] ?? '') : '';
    if (editingApiKeyId === null) {
      setApiKeyIds([...renderApiKeyIds, makeClientId()]);
    }
    updateApiKeys(nextKeys);
    if (editingApiKeyId !== null) {
      renameAccessRule(previousKey, trimmed);
    }
    closeModal();
  };

  const handleCopy = async (apiKey: string) => {
    const copied = await copyToClipboard(apiKey);
    showNotification(
      t(copied ? 'notification.link_copied' : 'notification.copy_failed'),
      copied ? 'success' : 'error'
    );
  };

  const handleGenerate = () => {
    setInputValue(generateSecureApiKey());
    setFormError('');
  };

  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <div className={styles.blockHeaderRow}>
        <label style={{ margin: 0 }}>{t('config_management.visual.api_keys.label')}</label>
        <Button size="sm" onClick={openAddModal} disabled={disabled}>
          {t('config_management.visual.api_keys.add')}
        </Button>
      </div>

      {apiKeys.length === 0 ? (
        <div className={styles.emptyState}>{t('config_management.visual.api_keys.empty')}</div>
      ) : (
        <div className="item-list" style={{ marginTop: 4 }}>
          {apiKeys.map((key, index) => {
            const accessRule = readApiKeyAccessRule(apiKeyAccessRules, key);
            const isRestricted = Boolean(accessRule && accessRule.access !== 'all');
            const providerTargetValues = providerTargetValuesForRule(
              accessRule,
              providerTargetOptions
            );
            const providerTargetLabels = selectedOptionLabels(
              providerTargetValues,
              providerTargetOptions,
              (value) =>
                providerTargetLabelFromValue(
                  value,
                  t('config_management.visual.api_keys.default_base_url')
                )
            );
            const authFileValues =
              accessRule && accessRule.access !== 'all' ? (accessRule.authFiles ?? []) : [];
            const authFileLabels = selectedOptionLabels(authFileValues, authFileOptions);

            return (
              <div
                key={renderApiKeyIds[index] ?? `${key}-${index}`}
                className={`item-row ${styles.apiKeyItemRow}`}
              >
                <div className={styles.apiKeySummaryRow}>
                  <div className="item-meta">
                    <div className="pill">#{index + 1}</div>
                    <div className="item-title">
                      {t('config_management.visual.api_keys.input_label')}
                    </div>
                    <div className="item-subtitle">{maskApiKey(String(key || ''))}</div>
                  </div>
                  <div className="item-actions">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCopy(key)}
                      disabled={disabled}
                    >
                      {t('common.copy')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEditModal(renderApiKeyIds[index] ?? '')}
                      disabled={disabled}
                    >
                      {t('config_management.visual.common.edit')}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(renderApiKeyIds[index] ?? '')}
                      disabled={disabled}
                    >
                      {t('config_management.visual.common.delete')}
                    </Button>
                  </div>
                </div>

                <div className={styles.apiKeyAccessScope}>
                  <div className={styles.apiKeyAccessMode}>
                    <div className={styles.blockLabel}>
                      {t('config_management.visual.api_keys.access_scope')}
                    </div>
                    <Select
                      value={isRestricted ? 'restricted' : 'all'}
                      options={accessOptions}
                      onChange={(nextMode) => updateAccessMode(key, nextMode)}
                      disabled={accessEditingDisabled}
                      size="sm"
                      ariaLabel={t('config_management.visual.api_keys.access_scope')}
                    />
                  </div>

                  {isRestricted ? (
                    <div className={styles.apiKeyAccessPickers}>
                      <div className={styles.apiKeyAccessPicker}>
                        <div className={styles.blockLabel}>
                          {t('config_management.visual.api_keys.providers_label')}
                        </div>
                        <AccessScopePickerField
                          value={providerTargetValues}
                          labels={providerTargetLabels}
                          options={providerTargetOptions}
                          disabled={accessEditingDisabled}
                          searchPlaceholder={t(
                            'config_management.visual.api_keys.provider_search_placeholder'
                          )}
                          emptyText={t('config_management.visual.api_keys.providers_empty')}
                          selectButtonLabel={t('config_management.visual.api_keys.select')}
                          selectedCountLabel={(selected, total) =>
                            t('config_management.visual.api_keys.selected_count', {
                              selected,
                              total,
                            })
                          }
                          onChange={(nextProviderTargets) =>
                            updateRestrictedList(key, 'providerTargets', nextProviderTargets)
                          }
                        />
                      </div>

                      <div className={styles.apiKeyAccessPicker}>
                        <div className={styles.blockLabel}>
                          {t('config_management.visual.api_keys.auth_files_label')}
                        </div>
                        <AccessScopePickerField
                          value={authFileValues}
                          labels={authFileLabels}
                          options={authFileOptions}
                          disabled={accessEditingDisabled}
                          searchPlaceholder={t(
                            'config_management.visual.api_keys.auth_file_search_placeholder'
                          )}
                          emptyText={t('config_management.visual.api_keys.auth_files_empty')}
                          selectButtonLabel={t('config_management.visual.api_keys.select')}
                          selectedCountLabel={(selected, total) =>
                            t('config_management.visual.api_keys.selected_count', {
                              selected,
                              total,
                            })
                          }
                          onChange={(nextAuthFiles) =>
                            updateRestrictedList(key, 'authFiles', nextAuthFiles)
                          }
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="hint">{t('config_management.visual.api_keys.hint')}</div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={
          editingApiKeyId !== null
            ? t('config_management.visual.api_keys.edit_title')
            : t('config_management.visual.api_keys.add_title')
        }
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={disabled}>
              {t('config_management.visual.common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={disabled}>
              {editingApiKeyId !== null
                ? t('config_management.visual.common.update')
                : t('config_management.visual.common.add')}
            </Button>
          </>
        }
      >
        <div className="form-group">
          <label htmlFor={apiKeyInputId}>
            {t('config_management.visual.api_keys.input_label')}
          </label>
          <div className={styles.apiKeyModalInputRow}>
            <input
              id={apiKeyInputId}
              className="input"
              placeholder={t('config_management.visual.api_keys.input_placeholder')}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={disabled}
              aria-describedby={formError ? `${apiKeyErrorId} ${apiKeyHintId}` : apiKeyHintId}
              aria-invalid={Boolean(formError)}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleGenerate}
              disabled={disabled}
            >
              {t('config_management.visual.api_keys.generate')}
            </Button>
          </div>
          <div id={apiKeyHintId} className="hint">
            {t('config_management.visual.api_keys.input_hint')}
          </div>
          {formError && (
            <div id={apiKeyErrorId} className="error-box">
              {formError}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
});

const AccessScopePickerField = memo(function AccessScopePickerField({
  value,
  labels,
  options,
  disabled,
  searchPlaceholder,
  emptyText,
  selectButtonLabel,
  selectedCountLabel,
  onChange,
}: {
  value: string[];
  labels: string[];
  options: AccessPickerOption[];
  disabled?: boolean;
  searchPlaceholder: string;
  emptyText: string;
  selectButtonLabel: string;
  selectedCountLabel: (selected: number, total: number) => string;
  onChange: (nextValues: string[]) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(value));
  const optionValueSet = useMemo(() => new Set(options.map((option) => option.value)), [options]);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) =>
      `${option.label} ${option.description ?? ''} ${option.value}`.toLowerCase().includes(q)
    );
  }, [options, search]);

  const allFilteredChecked =
    filteredOptions.length > 0 && filteredOptions.every((option) => selected.has(option.value));

  const openPicker = () => {
    setSelected(new Set(value.filter((selectedValue) => optionValueSet.has(selectedValue))));
    setSearch('');
    setOpen(true);
  };

  const toggle = (nextValue: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(nextValue)) next.delete(nextValue);
      else next.add(nextValue);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredChecked) {
        filteredOptions.forEach((option) => next.delete(option.value));
      } else {
        filteredOptions.forEach((option) => next.add(option.value));
      }
      return next;
    });
  };

  const handleApply = () => {
    onChange(Array.from(selected).filter((selectedValue) => optionValueSet.has(selectedValue)));
    setOpen(false);
  };

  return (
    <div className={styles.accessSelection}>
      <div className={styles.accessSelectionHeader}>
        <div className={styles.accessSelectionChips}>
          {labels.length > 0 ? (
            labels.map((label, index) => (
              <span
                key={`${value[index] ?? label}-${index}`}
                className={styles.accessSelectionChip}
              >
                {label}
              </span>
            ))
          ) : (
            <span className={styles.accessSelectionEmpty}>{emptyText}</span>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={openPicker} disabled={disabled}>
          {selectButtonLabel}
        </Button>
      </div>

      {open ? (
        <div className={styles.accessDiscoveryPanel}>
          <div className={styles.accessDiscoveryToolbar}>
            <div className={styles.accessDiscoverySearchWrap}>
              <span className={styles.accessDiscoverySearchIcon} aria-hidden="true">
                <IconSearch size={14} />
              </span>
              <input
                type="search"
                className={styles.accessDiscoverySearch}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                disabled={disabled}
              />
            </div>
          </div>

          {options.length ? (
            <>
              <div className={styles.accessDiscoveryBatchRow}>
                <SelectionCheckbox
                  checked={allFilteredChecked}
                  onChange={toggleAll}
                  disabled={disabled || filteredOptions.length === 0}
                  label={
                    <span className={styles.accessDiscoveryBatchLabel}>
                      {allFilteredChecked
                        ? t('config_management.visual.api_keys.clear_all')
                        : t('config_management.visual.api_keys.select_all')}
                    </span>
                  }
                />
                <span className={styles.accessDiscoveryCount}>
                  {selectedCountLabel(selected.size, options.length)}
                </span>
              </div>
              {filteredOptions.length ? (
                <ul className={styles.accessDiscoveryList}>
                  {filteredOptions.map((option) => (
                    <li key={option.value} className={styles.accessDiscoveryItem}>
                      <SelectionCheckbox
                        checked={selected.has(option.value)}
                        onChange={() => toggle(option.value)}
                        disabled={disabled}
                        label={
                          <span className={styles.accessDiscoveryName}>
                            <span>{option.label}</span>
                            {option.description ? <small>{option.description}</small> : null}
                          </span>
                        }
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className={styles.accessDiscoveryEmpty}>
                  {t('config_management.visual.api_keys.no_search_results')}
                </div>
              )}
            </>
          ) : (
            <div className={styles.accessDiscoveryEmpty}>{emptyText}</div>
          )}

          <div className={styles.accessDiscoveryFooter}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={disabled}
            >
              {t('config_management.visual.api_keys.close')}
            </Button>
            <Button size="sm" onClick={handleApply} disabled={disabled}>
              {t('config_management.visual.api_keys.apply', { count: selected.size })}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
});

export const StringListEditor = memo(function StringListEditor({
  value,
  disabled,
  placeholder,
  inputAriaLabel,
  onChange,
}: {
  value: string[];
  disabled?: boolean;
  placeholder?: string;
  inputAriaLabel?: string;
  onChange: (next: string[]) => void;
}) {
  const { t } = useTranslation();
  const items = value.length ? value : [];
  const [itemIds, setItemIds] = useState(() => items.map(() => makeClientId()));
  const renderItemIds = useMemo(() => {
    if (itemIds.length === items.length) return itemIds;
    if (itemIds.length > items.length) return itemIds.slice(0, items.length);
    return [
      ...itemIds,
      ...Array.from({ length: items.length - itemIds.length }, () => makeClientId()),
    ];
  }, [itemIds, items.length]);

  const updateItem = (index: number, nextValue: string) =>
    onChange(items.map((item, i) => (i === index ? nextValue : item)));
  const addItem = () => {
    setItemIds([...renderItemIds, makeClientId()]);
    onChange([...items, '']);
  };
  const removeItem = (index: number) => {
    setItemIds(renderItemIds.filter((_, i) => i !== index));
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className={styles.stringList}>
      {items.map((item, index) => (
        <div key={renderItemIds[index] ?? `item-${index}`} className={styles.stringListRow}>
          <ExpandableInput
            placeholder={placeholder}
            ariaLabel={inputAriaLabel ?? placeholder}
            value={item}
            onChange={(nextValue) => updateItem(index, nextValue)}
            disabled={disabled}
          />
          <Button variant="ghost" size="sm" onClick={() => removeItem(index)} disabled={disabled}>
            {t('config_management.visual.common.delete')}
          </Button>
        </div>
      ))}
      <div className={styles.actionRow}>
        <Button variant="secondary" size="sm" onClick={addItem} disabled={disabled}>
          {t('config_management.visual.common.add')}
        </Button>
      </div>
    </div>
  );
});

const PLUGIN_STORE_AUTH_TYPE_OPTIONS: Array<{ value: PluginStoreAuthType; labelKey: string }> = [
  { value: 'bearer', labelKey: 'config_management.visual.sections.system.store_auth_type_bearer' },
  {
    value: 'github-token',
    labelKey: 'config_management.visual.sections.system.store_auth_type_github_token',
  },
  { value: 'basic', labelKey: 'config_management.visual.sections.system.store_auth_type_basic' },
  { value: 'header', labelKey: 'config_management.visual.sections.system.store_auth_type_header' },
  { value: 'none', labelKey: 'config_management.visual.sections.system.store_auth_type_none' },
];

const PLUGIN_STORE_AUTH_APPLY_TO_OPTIONS: Array<{
  value: PluginStoreAuthApplyTo;
  labelKey: string;
}> = [
  {
    value: 'registry',
    labelKey: 'config_management.visual.sections.system.store_auth_apply_registry',
  },
  {
    value: 'metadata',
    labelKey: 'config_management.visual.sections.system.store_auth_apply_metadata',
  },
  {
    value: 'artifact',
    labelKey: 'config_management.visual.sections.system.store_auth_apply_artifact',
  },
];

const createPluginStoreAuthRule = (): PluginStoreAuthRule => ({
  id: makeClientId(),
  match: '',
  applyTo: [],
  type: 'bearer',
  tokenEnv: '',
  usernameEnv: '',
  passwordEnv: '',
  headerName: '',
  headerValueEnv: '',
  allowInsecure: false,
});

export const PluginStoreAuthEditor = memo(function PluginStoreAuthEditor({
  value,
  disabled,
  onChange,
}: {
  value: PluginStoreAuthRule[];
  disabled?: boolean;
  onChange: (next: PluginStoreAuthRule[]) => void;
}) {
  const { t } = useTranslation();

  const updateRule = (id: string, patch: Partial<PluginStoreAuthRule>) => {
    onChange(value.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  };
  const addRule = () => onChange([...value, createPluginStoreAuthRule()]);
  const removeRule = (id: string) => onChange(value.filter((rule) => rule.id !== id));
  const toggleApplyTo = (rule: PluginStoreAuthRule, kind: PluginStoreAuthApplyTo) => {
    const nextApplyTo = rule.applyTo.includes(kind)
      ? rule.applyTo.filter((item) => item !== kind)
      : [...rule.applyTo, kind];
    updateRule(rule.id, { applyTo: nextApplyTo });
  };

  return (
    <div className={styles.storeAuthEditor}>
      {value.length === 0 ? (
        <p className={styles.storeAuthEmpty}>
          {t('config_management.visual.sections.system.store_auth_empty')}
        </p>
      ) : null}
      {value.map((rule) => {
        const usesToken = rule.type === 'bearer' || rule.type === 'github-token';
        const usesBasic = rule.type === 'basic';
        const usesHeader = rule.type === 'header';
        return (
          <div key={rule.id} className={styles.storeAuthRule}>
            <div className={styles.storeAuthRuleHeader}>
              <strong>
                {rule.match || t('config_management.visual.sections.system.store_auth_rule')}
              </strong>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeRule(rule.id)}
                disabled={disabled}
              >
                {t('config_management.visual.common.delete')}
              </Button>
            </div>
            <div className={styles.storeAuthGrid}>
              <label className={styles.storeAuthField}>
                <span>{t('config_management.visual.sections.system.store_auth_match')}</span>
                <ExpandableInput
                  value={rule.match}
                  placeholder="https://api.github.com/repos/owner/repo/releases/"
                  disabled={disabled}
                  onChange={(match) => updateRule(rule.id, { match })}
                />
              </label>
              <label className={styles.storeAuthField}>
                <span>{t('config_management.visual.sections.system.store_auth_type')}</span>
                <Select
                  value={rule.type}
                  options={PLUGIN_STORE_AUTH_TYPE_OPTIONS.map((option) => ({
                    value: option.value,
                    label: t(option.labelKey),
                  }))}
                  disabled={disabled}
                  onChange={(type) => updateRule(rule.id, { type: type as PluginStoreAuthType })}
                />
              </label>
            </div>

            <div className={styles.storeAuthApplyTo}>
              <span>{t('config_management.visual.sections.system.store_auth_apply_to')}</span>
              <div className={styles.storeAuthCheckboxes}>
                {PLUGIN_STORE_AUTH_APPLY_TO_OPTIONS.map((option) => (
                  <label key={option.value} className={styles.storeAuthCheckbox}>
                    <input
                      type="checkbox"
                      checked={rule.applyTo.includes(option.value)}
                      disabled={disabled}
                      onChange={() => toggleApplyTo(rule, option.value)}
                    />
                    <span>{t(option.labelKey)}</span>
                  </label>
                ))}
              </div>
              <small>
                {t('config_management.visual.sections.system.store_auth_apply_to_hint')}
              </small>
            </div>

            {usesToken ? (
              <label className={styles.storeAuthField}>
                <span>{t('config_management.visual.sections.system.store_auth_token_env')}</span>
                <input
                  className="input"
                  value={rule.tokenEnv}
                  placeholder="CLIPROXY_PLUGIN_STORE_TOKEN"
                  disabled={disabled}
                  onChange={(event) => updateRule(rule.id, { tokenEnv: event.target.value })}
                />
              </label>
            ) : null}

            {usesBasic ? (
              <div className={styles.storeAuthGrid}>
                <label className={styles.storeAuthField}>
                  <span>
                    {t('config_management.visual.sections.system.store_auth_username_env')}
                  </span>
                  <input
                    className="input"
                    value={rule.usernameEnv}
                    disabled={disabled}
                    onChange={(event) => updateRule(rule.id, { usernameEnv: event.target.value })}
                  />
                </label>
                <label className={styles.storeAuthField}>
                  <span>
                    {t('config_management.visual.sections.system.store_auth_password_env')}
                  </span>
                  <input
                    className="input"
                    value={rule.passwordEnv}
                    disabled={disabled}
                    onChange={(event) => updateRule(rule.id, { passwordEnv: event.target.value })}
                  />
                </label>
              </div>
            ) : null}

            {usesHeader ? (
              <div className={styles.storeAuthGrid}>
                <label className={styles.storeAuthField}>
                  <span>
                    {t('config_management.visual.sections.system.store_auth_header_name')}
                  </span>
                  <input
                    className="input"
                    value={rule.headerName}
                    placeholder="X-Plugin-Token"
                    disabled={disabled}
                    onChange={(event) => updateRule(rule.id, { headerName: event.target.value })}
                  />
                </label>
                <label className={styles.storeAuthField}>
                  <span>
                    {t('config_management.visual.sections.system.store_auth_header_value_env')}
                  </span>
                  <input
                    className="input"
                    value={rule.headerValueEnv}
                    disabled={disabled}
                    onChange={(event) =>
                      updateRule(rule.id, { headerValueEnv: event.target.value })
                    }
                  />
                </label>
              </div>
            ) : null}

            <label className={styles.storeAuthCheckbox}>
              <input
                type="checkbox"
                checked={rule.allowInsecure}
                disabled={disabled}
                onChange={(event) => updateRule(rule.id, { allowInsecure: event.target.checked })}
              />
              <span>{t('config_management.visual.sections.system.store_auth_allow_insecure')}</span>
            </label>
          </div>
        );
      })}
      <div className={styles.actionRow}>
        <Button variant="secondary" size="sm" onClick={addRule} disabled={disabled}>
          {t('config_management.visual.sections.system.store_auth_add')}
        </Button>
      </div>
    </div>
  );
});

function hasPayloadModelAdvancedSettings(model: PayloadModelEntry) {
  return Boolean(
    model.fromProtocol ||
    (model.headers?.length ?? 0) > 0 ||
    (model.match?.length ?? 0) > 0 ||
    (model.notMatch?.length ?? 0) > 0 ||
    (model.exist?.length ?? 0) > 0 ||
    (model.notExist?.length ?? 0) > 0
  );
}

export const PayloadRulesEditor = memo(function PayloadRulesEditor({
  value,
  disabled,
  protocolFirst = false,
  rawJsonValues = false,
  onChange,
}: {
  value: PayloadRule[];
  disabled?: boolean;
  protocolFirst?: boolean;
  rawJsonValues?: boolean;
  onChange: (next: PayloadRule[]) => void;
}) {
  const { t } = useTranslation();
  const rules = value;
  const protocolOptions = useMemo(() => buildProtocolOptions(t, rules), [rules, t]);
  const fromProtocolOptions = useMemo(
    () => [
      {
        value: '',
        label: t('config_management.visual.payload_rules.provider_default'),
      },
      {
        value: 'openai',
        label: t('config_management.visual.payload_rules.provider_openai'),
      },
      {
        value: 'responses',
        label: t('config_management.visual.payload_rules.provider_responses'),
      },
      {
        value: 'gemini',
        label: t('config_management.visual.payload_rules.provider_gemini'),
      },
      {
        value: 'claude',
        label: t('config_management.visual.payload_rules.provider_claude'),
      },
    ],
    [t]
  );
  const payloadValueTypeOptions = useMemo(
    () =>
      VISUAL_CONFIG_PAYLOAD_VALUE_TYPE_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey, { defaultValue: option.defaultLabel }),
      })),
    [t]
  );
  const booleanValueOptions = useMemo(
    () => [
      { value: 'true', label: t('config_management.visual.payload_rules.boolean_true') },
      { value: 'false', label: t('config_management.visual.payload_rules.boolean_false') },
    ],
    [t]
  );
  const [modelAdvancedOverrides, setModelAdvancedOverrides] = useState<Record<string, boolean>>({});

  const addRule = () => onChange([...rules, { id: makeClientId(), models: [], params: [] }]);
  const removeRule = (ruleIndex: number) => onChange(rules.filter((_, i) => i !== ruleIndex));

  const updateRule = (ruleIndex: number, patch: Partial<PayloadRule>) =>
    onChange(rules.map((rule, i) => (i === ruleIndex ? { ...rule, ...patch } : rule)));

  const addModel = (ruleIndex: number) => {
    const rule = rules[ruleIndex];
    const nextModel: PayloadModelEntry = { id: makeClientId(), name: '', protocol: undefined };
    updateRule(ruleIndex, { models: [...rule.models, nextModel] });
  };

  const removeModel = (ruleIndex: number, modelIndex: number) => {
    const rule = rules[ruleIndex];
    updateRule(ruleIndex, { models: rule.models.filter((_, i) => i !== modelIndex) });
  };

  const updateModel = (
    ruleIndex: number,
    modelIndex: number,
    patch: Partial<PayloadModelEntry>
  ) => {
    const rule = rules[ruleIndex];
    updateRule(ruleIndex, {
      models: rule.models.map((m, i) => (i === modelIndex ? { ...m, ...patch } : m)),
    });
  };

  const toggleModelAdvanced = (modelId: string, defaultExpanded: boolean) => {
    setModelAdvancedOverrides((current) => ({
      ...current,
      [modelId]: !(current[modelId] ?? defaultExpanded),
    }));
  };

  const addHeader = (ruleIndex: number, modelIndex: number) => {
    const rule = rules[ruleIndex];
    const model = rule.models[modelIndex];
    updateModel(ruleIndex, modelIndex, {
      headers: [...(model.headers ?? []), { id: makeClientId(), name: '', value: '' }],
    });
  };

  const updateHeader = (
    ruleIndex: number,
    modelIndex: number,
    headerIndex: number,
    patch: Partial<PayloadHeaderEntry>
  ) => {
    const model = rules[ruleIndex].models[modelIndex];
    updateModel(ruleIndex, modelIndex, {
      headers: (model.headers ?? []).map((header, i) =>
        i === headerIndex ? { ...header, ...patch } : header
      ),
    });
  };

  const removeHeader = (ruleIndex: number, modelIndex: number, headerIndex: number) => {
    const model = rules[ruleIndex].models[modelIndex];
    updateModel(ruleIndex, modelIndex, {
      headers: (model.headers ?? []).filter((_, i) => i !== headerIndex),
    });
  };

  const addCondition = (ruleIndex: number, modelIndex: number, key: 'match' | 'notMatch') => {
    const model = rules[ruleIndex].models[modelIndex];
    updateModel(ruleIndex, modelIndex, {
      [key]: [
        ...(model[key] ?? []),
        { id: makeClientId(), path: '', valueType: 'string', value: '' },
      ],
    });
  };

  const updateCondition = (
    ruleIndex: number,
    modelIndex: number,
    key: 'match' | 'notMatch',
    conditionIndex: number,
    patch: Partial<PayloadParamEntry>
  ) => {
    const model = rules[ruleIndex].models[modelIndex];
    updateModel(ruleIndex, modelIndex, {
      [key]: (model[key] ?? []).map((condition, i) =>
        i === conditionIndex ? { ...condition, ...patch } : condition
      ),
    });
  };

  const removeCondition = (
    ruleIndex: number,
    modelIndex: number,
    key: 'match' | 'notMatch',
    conditionIndex: number
  ) => {
    const model = rules[ruleIndex].models[modelIndex];
    updateModel(ruleIndex, modelIndex, {
      [key]: (model[key] ?? []).filter((_, i) => i !== conditionIndex),
    });
  };

  const addParam = (ruleIndex: number) => {
    const rule = rules[ruleIndex];
    const nextParam: PayloadParamEntry = {
      id: makeClientId(),
      path: '',
      valueType: rawJsonValues ? 'json' : 'string',
      value: '',
    };
    updateRule(ruleIndex, { params: [...rule.params, nextParam] });
  };

  const removeParam = (ruleIndex: number, paramIndex: number) => {
    const rule = rules[ruleIndex];
    updateRule(ruleIndex, { params: rule.params.filter((_, i) => i !== paramIndex) });
  };

  const updateParam = (
    ruleIndex: number,
    paramIndex: number,
    patch: Partial<PayloadParamEntry>
  ) => {
    const rule = rules[ruleIndex];
    updateRule(ruleIndex, {
      params: rule.params.map((p, i) => (i === paramIndex ? { ...p, ...patch } : p)),
    });
  };

  const getValuePlaceholder = (valueType: PayloadParamValueType) => {
    switch (valueType) {
      case 'string':
        return t('config_management.visual.payload_rules.value_string');
      case 'number':
        return t('config_management.visual.payload_rules.value_number');
      case 'boolean':
        return t('config_management.visual.payload_rules.value_boolean');
      case 'json':
        return t('config_management.visual.payload_rules.value_json');
      default:
        return t('config_management.visual.payload_rules.value_default');
    }
  };

  const getParamErrorMessage = (param: PayloadParamEntry) => {
    const errorCode = getPayloadParamValidationError(
      rawJsonValues ? { ...param, valueType: 'json' } : param
    );
    return getValidationMessage(t, errorCode);
  };

  const renderConditionValueEditor = (
    ruleIndex: number,
    modelIndex: number,
    key: 'match' | 'notMatch',
    conditionIndex: number,
    condition: PayloadParamEntry
  ) => {
    if (condition.valueType === 'boolean') {
      return (
        <Select
          value={
            condition.value.toLowerCase() === 'true' || condition.value.toLowerCase() === 'false'
              ? condition.value.toLowerCase()
              : ''
          }
          options={booleanValueOptions}
          placeholder={t('config_management.visual.payload_rules.value_boolean')}
          disabled={disabled}
          ariaLabel={t('config_management.visual.payload_rules.condition_value')}
          onChange={(nextValue) =>
            updateCondition(ruleIndex, modelIndex, key, conditionIndex, { value: nextValue })
          }
        />
      );
    }

    if (condition.valueType === 'json') {
      return (
        <textarea
          className={`input ${styles.payloadJsonInput}`}
          placeholder={getValuePlaceholder(condition.valueType)}
          aria-label={t('config_management.visual.payload_rules.condition_value')}
          value={condition.value}
          onChange={(e) =>
            updateCondition(ruleIndex, modelIndex, key, conditionIndex, {
              value: e.target.value,
            })
          }
          disabled={disabled}
        />
      );
    }

    return (
      <ExpandableInput
        placeholder={getValuePlaceholder(condition.valueType)}
        ariaLabel={t('config_management.visual.payload_rules.condition_value')}
        value={condition.value}
        onChange={(nextValue) =>
          updateCondition(ruleIndex, modelIndex, key, conditionIndex, { value: nextValue })
        }
        disabled={disabled}
      />
    );
  };

  const renderParamValueEditor = (
    ruleIndex: number,
    paramIndex: number,
    param: PayloadParamEntry
  ) => {
    if (rawJsonValues) {
      return (
        <textarea
          className={`input ${styles.payloadJsonInput}`}
          placeholder={t('config_management.visual.payload_rules.value_raw_json')}
          aria-label={t('config_management.visual.payload_rules.param_value')}
          value={param.value}
          onChange={(e) =>
            updateParam(ruleIndex, paramIndex, { value: e.target.value, valueType: 'json' })
          }
          disabled={disabled}
        />
      );
    }

    if (param.valueType === 'boolean') {
      return (
        <Select
          value={
            param.value.toLowerCase() === 'true' || param.value.toLowerCase() === 'false'
              ? param.value.toLowerCase()
              : ''
          }
          options={booleanValueOptions}
          placeholder={t('config_management.visual.payload_rules.value_boolean')}
          disabled={disabled}
          ariaLabel={t('config_management.visual.payload_rules.param_value')}
          onChange={(nextValue) => updateParam(ruleIndex, paramIndex, { value: nextValue })}
        />
      );
    }

    if (param.valueType === 'json') {
      return (
        <textarea
          className={`input ${styles.payloadJsonInput}`}
          placeholder={getValuePlaceholder(param.valueType)}
          aria-label={t('config_management.visual.payload_rules.param_value')}
          value={param.value}
          onChange={(e) => updateParam(ruleIndex, paramIndex, { value: e.target.value })}
          disabled={disabled}
        />
      );
    }

    return (
      <ExpandableInput
        placeholder={getValuePlaceholder(param.valueType)}
        ariaLabel={t('config_management.visual.payload_rules.param_value')}
        value={param.value}
        onChange={(nextValue) => updateParam(ruleIndex, paramIndex, { value: nextValue })}
        disabled={disabled}
      />
    );
  };

  return (
    <div className={styles.blockStack}>
      {rules.map((rule, ruleIndex) => (
        <div key={rule.id} className={styles.ruleCard}>
          <div className={styles.ruleCardHeader}>
            <div className={styles.ruleCardTitle}>
              {t('config_management.visual.payload_rules.rule')} {ruleIndex + 1}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeRule(ruleIndex)}
              disabled={disabled}
            >
              {t('config_management.visual.common.delete')}
            </Button>
          </div>

          <div className={styles.blockStack}>
            <div className={styles.blockLabel}>
              {t('config_management.visual.payload_rules.models')}
            </div>
            {(rule.models.length ? rule.models : []).map((model, modelIndex) => {
              const hasAdvancedSettings = hasPayloadModelAdvancedSettings(model);
              const advancedExpanded = modelAdvancedOverrides[model.id] ?? hasAdvancedSettings;

              return (
                <div key={model.id} className={styles.payloadModelGroup}>
                  <div
                    className={[
                      styles.payloadRuleModelRow,
                      protocolFirst ? styles.payloadRuleModelRowProtocolFirst : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {protocolFirst ? (
                      <>
                        <Select
                          value={model.protocol ?? ''}
                          options={protocolOptions}
                          disabled={disabled}
                          ariaLabel={t('config_management.visual.payload_rules.provider_type')}
                          onChange={(nextValue) =>
                            updateModel(ruleIndex, modelIndex, {
                              protocol: (nextValue || undefined) as PayloadModelEntry['protocol'],
                            })
                          }
                        />
                        <ExpandableInput
                          placeholder={t('config_management.visual.payload_rules.model_name')}
                          ariaLabel={t('config_management.visual.payload_rules.model_name')}
                          value={model.name}
                          onChange={(nextValue) =>
                            updateModel(ruleIndex, modelIndex, { name: nextValue })
                          }
                          disabled={disabled}
                        />
                      </>
                    ) : (
                      <>
                        <ExpandableInput
                          placeholder={t('config_management.visual.payload_rules.model_name')}
                          ariaLabel={t('config_management.visual.payload_rules.model_name')}
                          value={model.name}
                          onChange={(nextValue) =>
                            updateModel(ruleIndex, modelIndex, { name: nextValue })
                          }
                          disabled={disabled}
                        />
                        <Select
                          value={model.protocol ?? ''}
                          options={protocolOptions}
                          disabled={disabled}
                          ariaLabel={t('config_management.visual.payload_rules.provider_type')}
                          onChange={(nextValue) =>
                            updateModel(ruleIndex, modelIndex, {
                              protocol: (nextValue || undefined) as PayloadModelEntry['protocol'],
                            })
                          }
                        />
                      </>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      className={styles.payloadRowActionButton}
                      onClick={() => toggleModelAdvanced(model.id, hasAdvancedSettings)}
                      disabled={disabled}
                    >
                      {advancedExpanded
                        ? t('config_management.visual.payload_rules.hide_advanced')
                        : t('config_management.visual.payload_rules.advanced')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={styles.payloadRowActionButton}
                      onClick={() => removeModel(ruleIndex, modelIndex)}
                      disabled={disabled}
                    >
                      {t('config_management.visual.common.delete')}
                    </Button>
                  </div>

                  {advancedExpanded ? (
                    <div className={styles.payloadModelAdvanced}>
                      <div className={styles.payloadAdvancedGrid}>
                        <div className={styles.fieldShell}>
                          <label className={styles.fieldLabel}>
                            {t('config_management.visual.payload_rules.from_protocol')}
                          </label>
                          <Select
                            value={model.fromProtocol ?? ''}
                            options={fromProtocolOptions}
                            disabled={disabled}
                            ariaLabel={t('config_management.visual.payload_rules.from_protocol')}
                            onChange={(nextValue) =>
                              updateModel(ruleIndex, modelIndex, {
                                fromProtocol: (nextValue ||
                                  undefined) as PayloadModelEntry['fromProtocol'],
                              })
                            }
                          />
                        </div>
                      </div>

                      <div className={styles.blockStack}>
                        <div className={styles.blockLabel}>
                          {t('config_management.visual.payload_rules.headers')}
                        </div>
                        {(model.headers ?? []).map((header, headerIndex) => (
                          <div key={header.id} className={styles.payloadHeaderRow}>
                            <ExpandableInput
                              placeholder={t('config_management.visual.payload_rules.header_name')}
                              ariaLabel={t('config_management.visual.payload_rules.header_name')}
                              value={header.name}
                              onChange={(nextValue) =>
                                updateHeader(ruleIndex, modelIndex, headerIndex, {
                                  name: nextValue,
                                })
                              }
                              disabled={disabled}
                            />
                            <ExpandableInput
                              placeholder={t('config_management.visual.payload_rules.header_value')}
                              ariaLabel={t('config_management.visual.payload_rules.header_value')}
                              value={header.value}
                              onChange={(nextValue) =>
                                updateHeader(ruleIndex, modelIndex, headerIndex, {
                                  value: nextValue,
                                })
                              }
                              disabled={disabled}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className={styles.payloadRowActionButton}
                              onClick={() => removeHeader(ruleIndex, modelIndex, headerIndex)}
                              disabled={disabled}
                            >
                              {t('config_management.visual.common.delete')}
                            </Button>
                          </div>
                        ))}
                        <div className={styles.actionRow}>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => addHeader(ruleIndex, modelIndex)}
                            disabled={disabled}
                          >
                            {t('config_management.visual.payload_rules.add_header')}
                          </Button>
                        </div>
                      </div>

                      {(['match', 'notMatch'] as const).map((conditionKey) => (
                        <div key={conditionKey} className={styles.blockStack}>
                          <div className={styles.blockLabel}>
                            {t(`config_management.visual.payload_rules.${conditionKey}`)}
                          </div>
                          {(model[conditionKey] ?? []).map((condition, conditionIndex) => {
                            const conditionError = getValidationMessage(
                              t,
                              getPayloadParamValidationError(condition)
                            );

                            return (
                              <div key={condition.id} className={styles.payloadRuleParamGroup}>
                                <div className={styles.payloadRuleParamRow}>
                                  <ExpandableInput
                                    placeholder={t(
                                      'config_management.visual.payload_rules.condition_path'
                                    )}
                                    ariaLabel={t(
                                      'config_management.visual.payload_rules.condition_path'
                                    )}
                                    value={condition.path}
                                    onChange={(nextValue) =>
                                      updateCondition(
                                        ruleIndex,
                                        modelIndex,
                                        conditionKey,
                                        conditionIndex,
                                        { path: nextValue }
                                      )
                                    }
                                    disabled={disabled}
                                  />
                                  <Select
                                    value={condition.valueType}
                                    options={payloadValueTypeOptions}
                                    disabled={disabled}
                                    ariaLabel={t(
                                      'config_management.visual.payload_rules.param_type'
                                    )}
                                    onChange={(nextValue) =>
                                      updateCondition(
                                        ruleIndex,
                                        modelIndex,
                                        conditionKey,
                                        conditionIndex,
                                        {
                                          valueType: nextValue as PayloadParamValueType,
                                          value:
                                            nextValue === 'boolean'
                                              ? 'true'
                                              : nextValue === 'json' &&
                                                  condition.value.trim() === ''
                                                ? '{}'
                                                : condition.value,
                                        }
                                      )
                                    }
                                  />
                                  {renderConditionValueEditor(
                                    ruleIndex,
                                    modelIndex,
                                    conditionKey,
                                    conditionIndex,
                                    condition
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={styles.payloadRowActionButton}
                                    onClick={() =>
                                      removeCondition(
                                        ruleIndex,
                                        modelIndex,
                                        conditionKey,
                                        conditionIndex
                                      )
                                    }
                                    disabled={disabled}
                                  >
                                    {t('config_management.visual.common.delete')}
                                  </Button>
                                </div>
                                {conditionError ? (
                                  <div className={`error-box ${styles.payloadParamError}`}>
                                    {conditionError}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                          <div className={styles.actionRow}>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => addCondition(ruleIndex, modelIndex, conditionKey)}
                              disabled={disabled}
                            >
                              {t('config_management.visual.payload_rules.add_condition')}
                            </Button>
                          </div>
                        </div>
                      ))}

                      <div className={styles.payloadAdvancedGrid}>
                        <div className={styles.blockStack}>
                          <div className={styles.blockLabel}>
                            {t('config_management.visual.payload_rules.exist')}
                          </div>
                          <StringListEditor
                            value={model.exist ?? []}
                            disabled={disabled}
                            placeholder={t('config_management.visual.payload_rules.condition_path')}
                            inputAriaLabel={t(
                              'config_management.visual.payload_rules.condition_path'
                            )}
                            onChange={(exist) => updateModel(ruleIndex, modelIndex, { exist })}
                          />
                        </div>
                        <div className={styles.blockStack}>
                          <div className={styles.blockLabel}>
                            {t('config_management.visual.payload_rules.notExist')}
                          </div>
                          <StringListEditor
                            value={model.notExist ?? []}
                            disabled={disabled}
                            placeholder={t('config_management.visual.payload_rules.condition_path')}
                            inputAriaLabel={t(
                              'config_management.visual.payload_rules.condition_path'
                            )}
                            onChange={(notExist) =>
                              updateModel(ruleIndex, modelIndex, { notExist })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
            <div className={styles.actionRow}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => addModel(ruleIndex)}
                disabled={disabled}
              >
                {t('config_management.visual.payload_rules.add_model')}
              </Button>
            </div>
          </div>

          <div className={styles.blockStack}>
            <div className={styles.blockLabel}>
              {t('config_management.visual.payload_rules.params')}
            </div>
            {(rule.params.length ? rule.params : []).map((param, paramIndex) => {
              const paramError = getParamErrorMessage(param);

              return (
                <div key={param.id} className={styles.payloadRuleParamGroup}>
                  <div
                    className={[
                      styles.payloadRuleParamRow,
                      rawJsonValues ? styles.payloadRuleRawParamRow : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <ExpandableInput
                      placeholder={t('config_management.visual.payload_rules.json_path')}
                      ariaLabel={t('config_management.visual.payload_rules.json_path')}
                      value={param.path}
                      onChange={(nextValue) =>
                        updateParam(ruleIndex, paramIndex, { path: nextValue })
                      }
                      disabled={disabled}
                    />
                    {rawJsonValues ? null : (
                      <Select
                        value={param.valueType}
                        options={payloadValueTypeOptions}
                        disabled={disabled}
                        ariaLabel={t('config_management.visual.payload_rules.param_type')}
                        onChange={(nextValue) =>
                          updateParam(ruleIndex, paramIndex, {
                            valueType: nextValue as PayloadParamValueType,
                            value:
                              nextValue === 'boolean'
                                ? 'true'
                                : nextValue === 'json' && param.value.trim() === ''
                                  ? '{}'
                                  : param.value,
                          })
                        }
                      />
                    )}
                    {renderParamValueEditor(ruleIndex, paramIndex, param)}
                    <Button
                      variant="ghost"
                      size="sm"
                      className={styles.payloadRowActionButton}
                      onClick={() => removeParam(ruleIndex, paramIndex)}
                      disabled={disabled}
                    >
                      {t('config_management.visual.common.delete')}
                    </Button>
                  </div>
                  {paramError && (
                    <div className={`error-box ${styles.payloadParamError}`}>{paramError}</div>
                  )}
                </div>
              );
            })}
            <div className={styles.actionRow}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => addParam(ruleIndex)}
                disabled={disabled}
              >
                {t('config_management.visual.payload_rules.add_param')}
              </Button>
            </div>
          </div>
        </div>
      ))}

      {rules.length === 0 && (
        <div className={styles.emptyState}>
          {t('config_management.visual.payload_rules.no_rules')}
        </div>
      )}

      <div className={styles.actionRow}>
        <Button variant="secondary" size="sm" onClick={addRule} disabled={disabled}>
          {t('config_management.visual.payload_rules.add_rule')}
        </Button>
      </div>
    </div>
  );
});

export const PayloadFilterRulesEditor = memo(function PayloadFilterRulesEditor({
  value,
  disabled,
  onChange,
}: {
  value: PayloadFilterRule[];
  disabled?: boolean;
  onChange: (next: PayloadFilterRule[]) => void;
}) {
  const { t } = useTranslation();
  const rules = value;
  const protocolOptions = useMemo(() => buildProtocolOptions(t, rules), [rules, t]);

  const addRule = () => onChange([...rules, { id: makeClientId(), models: [], params: [] }]);
  const removeRule = (ruleIndex: number) => onChange(rules.filter((_, i) => i !== ruleIndex));

  const updateRule = (ruleIndex: number, patch: Partial<PayloadFilterRule>) =>
    onChange(rules.map((rule, i) => (i === ruleIndex ? { ...rule, ...patch } : rule)));

  const addModel = (ruleIndex: number) => {
    const rule = rules[ruleIndex];
    const nextModel: PayloadModelEntry = { id: makeClientId(), name: '', protocol: undefined };
    updateRule(ruleIndex, { models: [...rule.models, nextModel] });
  };

  const removeModel = (ruleIndex: number, modelIndex: number) => {
    const rule = rules[ruleIndex];
    updateRule(ruleIndex, { models: rule.models.filter((_, i) => i !== modelIndex) });
  };

  const updateModel = (
    ruleIndex: number,
    modelIndex: number,
    patch: Partial<PayloadModelEntry>
  ) => {
    const rule = rules[ruleIndex];
    updateRule(ruleIndex, {
      models: rule.models.map((m, i) => (i === modelIndex ? { ...m, ...patch } : m)),
    });
  };

  return (
    <div className={styles.blockStack}>
      {rules.map((rule, ruleIndex) => (
        <div key={rule.id} className={styles.ruleCard}>
          <div className={styles.ruleCardHeader}>
            <div className={styles.ruleCardTitle}>
              {t('config_management.visual.payload_rules.rule')} {ruleIndex + 1}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeRule(ruleIndex)}
              disabled={disabled}
            >
              {t('config_management.visual.common.delete')}
            </Button>
          </div>

          <div className={styles.blockStack}>
            <div className={styles.blockLabel}>
              {t('config_management.visual.payload_rules.models')}
            </div>
            {rule.models.map((model, modelIndex) => (
              <div key={model.id} className={styles.payloadFilterModelRow}>
                <ExpandableInput
                  placeholder={t('config_management.visual.payload_rules.model_name')}
                  ariaLabel={t('config_management.visual.payload_rules.model_name')}
                  value={model.name}
                  onChange={(nextValue) => updateModel(ruleIndex, modelIndex, { name: nextValue })}
                  disabled={disabled}
                />
                <Select
                  value={model.protocol ?? ''}
                  options={protocolOptions}
                  disabled={disabled}
                  ariaLabel={t('config_management.visual.payload_rules.provider_type')}
                  onChange={(nextValue) =>
                    updateModel(ruleIndex, modelIndex, {
                      protocol: (nextValue || undefined) as PayloadModelEntry['protocol'],
                    })
                  }
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className={styles.payloadRowActionButton}
                  onClick={() => removeModel(ruleIndex, modelIndex)}
                  disabled={disabled}
                >
                  {t('config_management.visual.common.delete')}
                </Button>
              </div>
            ))}
            <div className={styles.actionRow}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => addModel(ruleIndex)}
                disabled={disabled}
              >
                {t('config_management.visual.payload_rules.add_model')}
              </Button>
            </div>
          </div>

          <div className={styles.blockStack}>
            <div className={styles.blockLabel}>
              {t('config_management.visual.payload_rules.remove_params')}
            </div>
            <StringListEditor
              value={rule.params}
              disabled={disabled}
              placeholder={t('config_management.visual.payload_rules.json_path_filter')}
              inputAriaLabel={t('config_management.visual.payload_rules.json_path_filter')}
              onChange={(params) => updateRule(ruleIndex, { params })}
            />
          </div>
        </div>
      ))}

      {rules.length === 0 && (
        <div className={styles.emptyState}>
          {t('config_management.visual.payload_rules.no_rules')}
        </div>
      )}

      <div className={styles.actionRow}>
        <Button variant="secondary" size="sm" onClick={addRule} disabled={disabled}>
          {t('config_management.visual.payload_rules.add_rule')}
        </Button>
      </div>
    </div>
  );
});
