const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

export const hashAPIKeyForUsage = async (apiKey: string): Promise<string> => {
  const trimmed = apiKey.trim();
  if (!trimmed) return '';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(trimmed));
  return toHex(digest);
};
