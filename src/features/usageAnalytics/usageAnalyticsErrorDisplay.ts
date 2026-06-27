interface UsageAnalyticsErrorSource {
  failed?: boolean;
  fail_summary?: string | null;
  fail_body?: string | null;
}

export interface UsageAnalyticsErrorDisplay {
  summary: string;
  title: string;
  detail: string;
}

const clean = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringifyMetadata = (value: unknown): string => {
  if (!isRecord(value)) return '';
  return Object.entries(value)
    .map(([key, entry]) => {
      const text = typeof entry === 'string' || typeof entry === 'number' ? String(entry) : '';
      return text ? `${key}: ${text}` : '';
    })
    .filter(Boolean)
    .join('\n');
};

const parseBodyJSON = (body: string): unknown => {
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
};

export function resolveUsageAnalyticsErrorDisplay(
  row: UsageAnalyticsErrorSource,
  emptyLabel: string
): UsageAnalyticsErrorDisplay {
  const fallbackSummary = clean(row.fail_summary);
  const bodyText = clean(row.fail_body);
  if (!row.failed && !fallbackSummary && !bodyText) {
    return { summary: '', title: '', detail: '' };
  }

  const parsed = parseBodyJSON(bodyText);

  let type = '';
  let message = '';
  let metadata = '';

  if (isRecord(parsed)) {
    type = clean(parsed.type);
    metadata = stringifyMetadata(parsed.metadata);

    const error = parsed.error;
    if (isRecord(error)) {
      type = clean(error.type) || type;
      message = clean(error.message) || clean(error.error);
      metadata = metadata || stringifyMetadata(error.metadata);
    } else if (typeof error === 'string') {
      message = clean(error);
    }

    message = message || clean(parsed.message);
  }

  const summary = message || fallbackSummary || (row.failed ? emptyLabel : '');
  const title = type && type !== 'error' ? type : summary || emptyLabel;
  const detail = [
    message && title !== message ? message : '',
    metadata || (!parsed ? bodyText : ''),
  ]
    .filter(Boolean)
    .join('\n');

  return {
    summary: summary || (row.failed ? emptyLabel : ''),
    title: title || (row.failed ? emptyLabel : ''),
    detail,
  };
}
