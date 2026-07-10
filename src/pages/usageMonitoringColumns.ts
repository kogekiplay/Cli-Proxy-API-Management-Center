export const MONITORING_COLUMN_WIDTHS = [8, 12, 14, 7, 14, 8, 11, 14, 7, 5] as const;

export const formatReasoningEffort = (value?: string | null) => {
  const normalized = value?.trim().toLowerCase() ?? '';
  return normalized || '-';
};
