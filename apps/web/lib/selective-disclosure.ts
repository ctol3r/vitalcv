/**
 * Selective disclosure helpers (wallet-side).
 *
 * Notes:
 * - This decodes JWT payloads WITHOUT verifying signature. It's intended for local wallet UX only.
 * - "Selective disclosure" here means: we omit unselected claims from the generated payload.
 */
export type ClaimPath = string;

const RESERVED_JWT_CLAIMS = new Set<string>([
  'iat',
  'exp',
  'iss',
  'sub',
  'aud',
  'nbf',
  'jti',
  'typ',
  'kid',
]);

export interface DisclosableClaim {
  path: ClaimPath;
  label: string;
  value: unknown;
  valuePreview: string;
}

export interface PresentationRequestPayload {
  type: 'vitalcv.presentation_request';
  version: '1.0';
  createdAt: string;
  credentialId: string;
  selectedClaimPaths: ClaimPath[];
  claims: Record<string, unknown>;
}

function base64UrlDecodeToString(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');

  // Browser (Next.js client)
  if (typeof globalThis.atob === 'function') {
    return globalThis.atob(padded);
  }

  // Node (tests)
  // eslint-disable-next-line no-restricted-globals
  return Buffer.from(padded, 'base64').toString('utf8');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function formatClaimLabel(path: string): string {
  const parts = path.split('.').filter(Boolean);
  return parts
    .map((part) =>
      part
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^\w/, (c) => c.toUpperCase()),
    )
    .join(' › ');
}

function formatValuePreview(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return '—';
  if (typeof value === 'string') return value.length > 64 ? `${value.slice(0, 61)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    const json = JSON.stringify(value);
    return json.length > 64 ? `${json.slice(0, 61)}…` : json;
  } catch {
    return String(value);
  }
}

function splitPath(path: string): Array<string | number> {
  return path.split('.').map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment));
}

function getValueAtPath(root: unknown, path: string): unknown {
  const segments = splitPath(path);
  let current: any = root;
  for (const seg of segments) {
    if (current == null) return undefined;
    current = current[seg as any];
  }
  return current;
}

function setValueAtPath(root: Record<string, unknown>, path: string, value: unknown): void {
  const segments = splitPath(path);
  let current: any = root;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;
    const nextSeg = segments[i + 1];

    if (isLast) {
      current[seg as any] = value;
      return;
    }

    const shouldBeArray = typeof nextSeg === 'number';
    if (current[seg as any] == null || typeof current[seg as any] !== 'object') {
      current[seg as any] = shouldBeArray ? [] : {};
    }
    current = current[seg as any];
  }
}

function flattenLeaves(
  value: unknown,
  prefix: string,
  out: Array<{ path: string; value: unknown }>,
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, idx) => {
      const path = prefix ? `${prefix}.${idx}` : String(idx);
      flattenLeaves(entry, path, out);
    });
    // If it's an empty array, still include a leaf to make it selectable.
    if (value.length === 0 && prefix) {
      out.push({ path: prefix, value });
    }
    return;
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    keys.forEach((key) => {
      const path = prefix ? `${prefix}.${key}` : key;
      flattenLeaves((value as Record<string, unknown>)[key], path, out);
    });
    // If it's an empty object, still include a leaf to make it selectable.
    if (keys.length === 0 && prefix) {
      out.push({ path: prefix, value });
    }
    return;
  }

  if (prefix) out.push({ path: prefix, value });
}

/**
 * Decode a JWT payload (unverified) into an object.
 */
export function decodeJwtPayloadUnverified(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payloadJson = base64UrlDecodeToString(parts[1]!);
    const parsed = JSON.parse(payloadJson);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Return disclosable claims as leaf paths (e.g., `additionalData.specialization`).
 * Excludes JWT reserved claims and excludes `credentialId` (treated as required elsewhere).
 */
export function listDisclosableClaims(payload: Record<string, unknown>): DisclosableClaim[] {
  const leaves: Array<{ path: string; value: unknown }> = [];

  for (const [key, value] of Object.entries(payload)) {
    if (RESERVED_JWT_CLAIMS.has(key)) continue;
    if (key === 'credentialId') continue;
    flattenLeaves(value, key, leaves);
  }

  return leaves
    .filter((leaf) => leaf.path && !RESERVED_JWT_CLAIMS.has(leaf.path))
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((leaf) => ({
      path: leaf.path,
      label: formatClaimLabel(leaf.path),
      value: leaf.value,
      valuePreview: formatValuePreview(leaf.value),
    }));
}

export function buildDisclosedClaims(
  payload: Record<string, unknown>,
  selectedClaimPaths: ClaimPath[],
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  const uniqueSelected = Array.from(new Set(selectedClaimPaths))
    .filter((path) => path && !RESERVED_JWT_CLAIMS.has(path))
    .sort((a, b) => a.localeCompare(b));

  for (const path of uniqueSelected) {
    // Prevent accidental disclosure of `credentialId` via selection; it's handled separately.
    if (path === 'credentialId' || path.startsWith('credentialId.')) continue;

    const value = getValueAtPath(payload, path);
    if (value === undefined) continue;
    setValueAtPath(output, path, value);
  }

  return output;
}

export function buildPresentationRequestPayload(input: {
  credentialId: string;
  payload: Record<string, unknown>;
  selectedClaimPaths: ClaimPath[];
  now?: Date;
}): PresentationRequestPayload {
  const createdAt = (input.now ?? new Date()).toISOString();
  const selectedClaimPaths = Array.from(new Set(input.selectedClaimPaths))
    .filter((path) => path && !RESERVED_JWT_CLAIMS.has(path))
    .sort((a, b) => a.localeCompare(b));

  return {
    type: 'vitalcv.presentation_request',
    version: '1.0',
    createdAt,
    credentialId: input.credentialId,
    selectedClaimPaths,
    claims: buildDisclosedClaims(input.payload, selectedClaimPaths),
  };
}

