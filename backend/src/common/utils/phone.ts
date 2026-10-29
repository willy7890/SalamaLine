/** Normalises a phone number to E.164 (+255...). Returns null when it cannot be a valid number. */
export function normalizePhone(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const compact = raw.trim().replace(/[\s\-().]/g, '');
  let digits = compact.startsWith('+') ? compact.slice(1) : compact;
  if (!/^\d+$/.test(digits)) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = `255${digits.slice(1)}`;
  else if (/^[67]\d{8}$/.test(digits)) digits = `255${digits}`;
  if (digits.startsWith('255') && digits.length !== 12) return null;
  if (digits.length < 10 || digits.length > 15) return null;
  return `+${digits}`;
}
