/**
 * Shared workspace fetch helper (Wave 600, C3) — one definition, replacing the
 * copy-pasted `fetchJson` in each surface client. Returns null on a non-OK
 * response so callers gate rendering consistently.
 */
export async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { cache: 'no-store' });
  return res.ok ? ((await res.json()) as T) : null;
}
