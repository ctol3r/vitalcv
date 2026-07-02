/**
 * Apply bundle id validation.
 *
 * Bundle ids are backend randomUUID() values stored in
 * VerificationArtifact.id, a Postgres uuid column. A non-uuid id can never
 * resolve — and querying the uuid column with one makes the backend throw —
 * so malformed ids must be rejected before any fetch.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidBundleId(bundleId: string): boolean {
  return UUID_RE.test(bundleId);
}
