/**
 * The posting link a person typed, as a URL to save. "lever.co/acme/123" was rejected with the
 * browser's "Please enter a URL" (2026-10-16 persona review); a missing scheme is now added.
 * Returns '' for an empty field and null when the text is not a web address.
 */
export function normalizePostingUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    // A host needs a dot ("lever.co"); "acme" alone is not an address.
    if (!/\.[a-z]{2,}$/i.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}
