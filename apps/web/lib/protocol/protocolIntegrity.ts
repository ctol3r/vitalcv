/**
 * Protocol-integrity primitives for VitalCV's public discovery
 * surfaces (WAVE: fix/protocol-integrity-hardening).
 *
 * Three concerns, one minimal module:
 *
 *   1. canonicalSerialize(value)     deterministic JSON output
 *   2. computeETag(canonicalJson)    strong ETag from canonical bytes
 *   3. canonicalizeHost(host)        strict per-request host normalization
 *
 * Design intent: every public protocol response (DID document, OID4VCI
 * metadata) must serialize the same way every time for the same input,
 * including for an offline verifier replaying months later. ETag
 * derives from canonical bytes so conditional GET (If-None-Match)
 * never lies. Host normalization rejects every injection vector we
 * can name; a malicious upstream proxy cannot widen the discovery
 * document's controller field.
 */

import { createHash } from 'node:crypto';

// canonicalSerialize -------------------------------------------------------

export function canonicalSerialize(value: unknown): string {
  return JSON.stringify(sortKeysRecursive(value));
}

function sortKeysRecursive(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortKeysRecursive);
  const entries = Object.entries(value as Record<string, unknown>);
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const out: Record<string, unknown> = {};
  for (const [k, v] of entries) out[k] = sortKeysRecursive(v);
  return out;
}

// ETag --------------------------------------------------------------------

export function computeETag(canonicalJson: string): string {
  const hex = createHash('sha256').update(canonicalJson).digest('hex');
  return `"${hex.slice(0, 16)}"`;
}

export function ifNoneMatchMatches(
  headerValue: string | null | undefined,
  etag: string,
): boolean {
  if (!headerValue) return false;
  const candidates = headerValue.split(',').map((s) => s.trim());
  if (candidates.includes('*')) return true;
  const weakEtag = `W/${etag}`;
  return candidates.some((c) => c === etag || c === weakEtag);
}

// canonicalizeHost --------------------------------------------------------

const HOST_MAX_LENGTH = 253; // RFC 1035 cumulative label limit
const HOST_PATTERN =
  /^[a-zA-Z0-9](?:[a-zA-Z0-9.\-_]*[a-zA-Z0-9])?(?::[0-9]+)?$/;
const PORT_MIN = 1;
const PORT_MAX = 65535;

/**
 * Acceptance criteria (binding):
 *  - 1 <= length <= 253
 *  - ASCII-only (HOST_PATTERN enforces this)
 *  - no control characters (caught by HOST_PATTERN ASCII-only class)
 *  - no whitespace
 *  - no path / query / fragment / scheme separator
 *  - 0 or 1 colons; if 1 colon, port must be numeric and 1..65535
 *  - lowercased (RFC 3986 case-insensitive host)
 */
export function canonicalizeHost(
  raw: string | null | undefined,
): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > HOST_MAX_LENGTH) return null;
  if (/\s/.test(trimmed)) return null;
  if (trimmed.includes('/')) return null;
  if (trimmed.includes('?')) return null;
  if (trimmed.includes('#')) return null;
  if (trimmed.includes('://')) return null;

  const colonCount = (trimmed.match(/:/g) ?? []).length;
  if (colonCount > 1) return null;

  if (colonCount === 1) {
    const [hostPart, portPart] = trimmed.split(':');
    if (!hostPart || !portPart) return null;
    if (!/^[0-9]+$/.test(portPart)) return null;
    const port = Number.parseInt(portPart, 10);
    if (port < PORT_MIN || port > PORT_MAX) return null;
    const lowerHost = hostPart.toLowerCase();
    const combined = `${lowerHost}:${port}`;
    if (!HOST_PATTERN.test(combined)) return null;
    return combined;
  }

  const lowered = trimmed.toLowerCase();
  if (!HOST_PATTERN.test(lowered)) return null;
  return lowered;
}

export function hostToDidWeb(host: string): string {
  const encoded = host.replace(/:/g, '%3A');
  return `did:web:${encoded}`;
}

// Headers / response envelope ---------------------------------------------

export const PROTOCOL_VARY_HEADER = 'Host, X-Forwarded-Host, Accept';
export const PROTOCOL_CACHE_CONTROL =
  'public, max-age=3600, stale-while-revalidate=86400';

export interface CanonicalJsonResponseInput<T> {
  value: T;
  contentType: string;
  ifNoneMatch?: string | null;
  cacheControl?: string;
  varyHeader?: string;
}

export interface CanonicalJsonResponseOutput {
  status: number;
  body: string | null;
  headers: Record<string, string>;
}

export function buildCanonicalJsonResponse<T>(
  input: CanonicalJsonResponseInput<T>,
): CanonicalJsonResponseOutput {
  const body = canonicalSerialize(input.value);
  const etag = computeETag(body);
  const baseHeaders: Record<string, string> = {
    'Content-Type': input.contentType,
    'Cache-Control': input.cacheControl ?? PROTOCOL_CACHE_CONTROL,
    Vary: input.varyHeader ?? PROTOCOL_VARY_HEADER,
    ETag: etag,
  };
  if (ifNoneMatchMatches(input.ifNoneMatch ?? null, etag)) {
    return { status: 304, body: null, headers: baseHeaders };
  }
  return { status: 200, body, headers: baseHeaders };
}
