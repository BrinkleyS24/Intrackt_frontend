const ENCRYPTED_VALUE_PREFIX = /^\s*enc:v\d+:/i;

export function isEncryptedPayload(value) {
  return typeof value === 'string' && ENCRYPTED_VALUE_PREFIX.test(value);
}

export function safeTextValue(value, fallback = '') {
  if (value == null) return fallback;
  const text = String(value);
  if (isEncryptedPayload(text)) return fallback;
  return text;
}

export function compactSafeTextValues(values = []) {
  return values
    .map((value) => safeTextValue(value, '').trim())
    .filter(Boolean);
}
