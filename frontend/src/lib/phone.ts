/** Normalize user input to E.164 (+country + number). */
export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";

  return hasPlus ? `+${digits}` : `+${digits}`;
}

/** E.164: + followed by 8–15 digits. */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

export function formatPhoneHint(phone: string): string {
  if (!phone) return "";
  if (phone.length <= 6) return phone;
  return `${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}`.trim();
}
