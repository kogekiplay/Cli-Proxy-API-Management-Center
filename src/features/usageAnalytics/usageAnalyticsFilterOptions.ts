export interface UsageFilterOption {
  value: string;
  label: string;
}

export interface UsageFilterSelection {
  provider?: string | null;
  model?: string | null;
  authIndex?: string | null;
  apiKeyHash?: string | null;
}

export interface UsageFilterSource {
  provider?: string | null;
  providerLabel?: string | null;
  model?: string | null;
  authIndex?: string | null;
  authLabel?: string | null;
  apiKeyHash?: string | null;
  apiKeyLabel?: string | null;
}

export interface UsageAuthFileFilterSource {
  provider?: string | null;
  authIndex?: string | null;
  label?: string | null;
}

export interface UsageAPIKeyFilterSource {
  value?: string | null;
  label?: string | null;
}

type FilterDimension = keyof UsageFilterSelection;

const EMPTY_VALUE = '';

const clean = (value: string | null | undefined) => value?.trim() ?? '';
const normalize = (value: string | null | undefined) => clean(value).toLowerCase();

const selectionValue = (selection: UsageFilterSelection, dimension: FilterDimension) => {
  switch (dimension) {
    case 'provider':
      return selection.provider;
    case 'model':
      return selection.model;
    case 'authIndex':
      return selection.authIndex;
    case 'apiKeyHash':
      return selection.apiKeyHash;
  }
};

const sourceValue = (source: UsageFilterSource, dimension: FilterDimension) => {
  switch (dimension) {
    case 'provider':
      return source.provider;
    case 'model':
      return source.model;
    case 'authIndex':
      return source.authIndex;
    case 'apiKeyHash':
      return source.apiKeyHash;
  }
};

const matchesSelection = (
  source: UsageFilterSource,
  selection: UsageFilterSelection,
  ignoreDimension: FilterDimension
) =>
  (['provider', 'model', 'authIndex', 'apiKeyHash'] as const).every((dimension) => {
    if (dimension === ignoreDimension) return true;
    const selected = normalize(selectionValue(selection, dimension));
    if (!selected) return true;
    const current = normalize(sourceValue(source, dimension));
    return current === selected;
  });

const hasContextualSelection = (
  selection: UsageFilterSelection,
  ignoreDimension: FilterDimension
) =>
  (['provider', 'model', 'authIndex', 'apiKeyHash'] as const).some(
    (dimension) => dimension !== ignoreDimension && normalize(selectionValue(selection, dimension))
  );

const addOption = (
  map: Map<string, string>,
  value: string | null | undefined,
  label?: string | null
) => {
  const cleanValue = clean(value);
  if (!cleanValue) return;
  if (!map.has(cleanValue)) {
    map.set(cleanValue, clean(label) || cleanValue);
  }
};

const toOptions = (
  map: Map<string, string>,
  allLabel: string,
  selectedValue?: string | null
): UsageFilterOption[] => {
  addOption(map, selectedValue, selectedValue);
  const options = Array.from(map.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true }));
  return [{ value: EMPTY_VALUE, label: allLabel }, ...options];
};

export function buildUsageProviderOptions({
  allLabel,
  selectedValue,
  selection,
  usageRows,
}: {
  allLabel: string;
  selectedValue?: string | null;
  selection: UsageFilterSelection;
  usageRows: UsageFilterSource[];
}): UsageFilterOption[] {
  const map = new Map<string, string>();
  usageRows
    .filter((row) => matchesSelection(row, selection, 'provider'))
    .forEach((row) => addOption(map, row.provider, row.providerLabel));
  return toOptions(map, allLabel, selectedValue);
}

export function buildUsageModelOptions({
  allLabel,
  selectedValue,
  selection,
  usageRows,
}: {
  allLabel: string;
  selectedValue?: string | null;
  selection: UsageFilterSelection;
  usageRows: UsageFilterSource[];
}): UsageFilterOption[] {
  const map = new Map<string, string>();
  usageRows
    .filter((row) => matchesSelection(row, selection, 'model'))
    .forEach((row) => addOption(map, row.model));
  return toOptions(map, allLabel, selectedValue);
}

export function buildUsageAuthIndexOptions({
  allLabel,
  authFiles,
  selectedValue,
  selection,
  usageRows,
}: {
  allLabel: string;
  authFiles: UsageAuthFileFilterSource[];
  selectedValue?: string | null;
  selection: UsageFilterSelection;
  usageRows: UsageFilterSource[];
}): UsageFilterOption[] {
  const providerFilter = normalize(selection.provider);
  const hasUsageContext =
    normalize(selection.model) || normalize(selection.apiKeyHash) || normalize(selection.authIndex);
  const matchingUsageAuthIndices = new Set(
    usageRows
      .filter((row) => matchesSelection(row, selection, 'authIndex'))
      .map((row) => clean(row.authIndex))
      .filter(Boolean)
  );
  const shouldNarrowByUsage = Boolean(hasUsageContext);

  const map = new Map<string, string>();
  authFiles.forEach((file) => {
    const provider = normalize(file.provider);
    const authIndex = clean(file.authIndex);
    if (!authIndex) return;
    if (providerFilter && provider !== providerFilter) return;
    if (shouldNarrowByUsage && !matchingUsageAuthIndices.has(authIndex)) return;
    addOption(map, authIndex, file.label);
  });

  return toOptions(map, allLabel, selectedValue);
}

export function buildUsageAPIKeyOptions({
  allLabel,
  configuredAPIKeys,
  selectedValue,
  selection,
  usageRows,
}: {
  allLabel: string;
  configuredAPIKeys: UsageAPIKeyFilterSource[];
  selectedValue?: string | null;
  selection: UsageFilterSelection;
  usageRows: UsageFilterSource[];
}): UsageFilterOption[] {
  const configuredLabelByHash = new Map<string, string>();
  configuredAPIKeys.forEach((key) => {
    const value = clean(key.value);
    if (value && !configuredLabelByHash.has(value)) {
      configuredLabelByHash.set(value, clean(key.label) || value);
    }
  });

  const map = new Map<string, string>();
  if (!hasContextualSelection(selection, 'apiKeyHash')) {
    configuredAPIKeys.forEach((key) => addOption(map, key.value, key.label));
    return toOptions(map, allLabel, selectedValue);
  }

  usageRows
    .filter((row) => matchesSelection(row, selection, 'apiKeyHash'))
    .forEach((row) => {
      const hash = clean(row.apiKeyHash);
      addOption(map, hash, configuredLabelByHash.get(hash) || row.apiKeyLabel || hash);
    });

  return toOptions(map, allLabel, selectedValue);
}
