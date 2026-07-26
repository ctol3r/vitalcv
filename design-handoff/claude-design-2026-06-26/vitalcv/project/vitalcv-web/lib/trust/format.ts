// VitalCV · Trust Surfaces · Formatters
// All client-safe. No locale-specific strings; everything reads UTC.

/** "9a8c2bc1ffd3…b8d3" → "9a8c…b8d3" */
export function shortHash(hash: string, head = 4, tail = 4): string {
  const clean = hash.replace(/^0x/, "").replace(/[^0-9a-f]/gi, "");
  if (clean.length <= head + tail + 1) return clean;
  return `${clean.slice(0, head)}…${clean.slice(-tail)}`;
}

/** ISO timestamp → "14:31:58Z" (intraday) or "2026-05-04" (cross-day) */
export function formatCheckedAt(iso: string, anchor = new Date()): string {
  const d = new Date(iso);
  const sameDay =
    d.getUTCFullYear() === anchor.getUTCFullYear() &&
    d.getUTCMonth() === anchor.getUTCMonth() &&
    d.getUTCDate() === anchor.getUTCDate();
  if (sameDay) {
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    const ss = String(d.getUTCSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}Z`;
  }
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dy = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dy}`;
}

/** ISO → "10 s ago", "2 m 54 s ago", "7 d ago" — terse, mono-friendly */
export function relativeAge(iso: string, now = new Date()): string {
  const t = new Date(iso).getTime();
  const sec = Math.max(0, Math.floor((now.getTime() - t) / 1000));
  if (sec < 60) return `${sec} s ago`;
  const min = Math.floor(sec / 60);
  const secRem = sec - min * 60;
  if (min < 60) return secRem ? `${min} m ${secRem} s ago` : `${min} m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.floor(hr / 24);
  return `${day} d ago`;
}

/** Build a Lineage object's two timestamp fields in one shot. */
export function lineageWhen(iso: string, now = new Date()) {
  return { checkedAtIso: formatCheckedAt(iso, now), checkedAgo: relativeAge(iso, now) };
}
