export const MONITORING_COLUMN_WIDTHS = [8, 11, 7, 7, 6, 12, 6, 8, 11, 13, 7, 4] as const;

export const formatReasoningEffort = (value?: string | null) => {
  const normalized = value?.trim().toLowerCase() ?? '';
  return normalized || '-';
};
