/**
 * pilotScope.ts — Pilot scoping contract for event capture
 *
 * PilotScope is attached to every SEAL event that has caller context.
 * It lives inside the `metadata` JSONB field at the top level under reserved keys.
 *
 * Storage layout in metadata:
 *   { pilotId: "acme-q1", workflowLane: "locum-rn", geographyTag: "CA", ...rest }
 *
 * Safe fallback: events without scope have these keys absent (null / missing).
 * The KPI service filters by checking path equality — missing key = unscoped event
 * is excluded from scoped queries but included in global queries.
 *
 * Fields:
 *   pilotId      — short slug identifying the pilot engagement (e.g. "acme-q1")
 *   workflowLane — hire type / credential type (e.g. "locum-rn", "perm-md", "cred-only")
 *   geographyTag — optional state code or region (e.g. "CA", "TX", "southeast")
 */

export interface PilotScope {
  pilotId?:      string | null;
  workflowLane?: string | null;
  geographyTag?: string | null;
}

/**
 * Merge PilotScope fields into an existing metadata object.
 * Scope fields are written only when non-null.
 * Returns a new merged metadata record (does not mutate input).
 */
export function mergeScope(
  metadata:  Record<string, unknown> = {},
  scope:     PilotScope | undefined | null,
): Record<string, unknown> {
  if (!scope) return metadata;
  const out: Record<string, unknown> = { ...metadata };
  if (scope.pilotId      != null) out.pilotId      = scope.pilotId;
  if (scope.workflowLane != null) out.workflowLane = scope.workflowLane;
  if (scope.geographyTag != null) out.geographyTag = scope.geographyTag;
  return out;
}

/**
 * Extract PilotScope from a raw metadata record (for KPI service reads).
 */
export function extractScope(
  metadata: Record<string, unknown>,
): PilotScope {
  return {
    pilotId:      typeof metadata.pilotId      === 'string' ? metadata.pilotId      : null,
    workflowLane: typeof metadata.workflowLane === 'string' ? metadata.workflowLane : null,
    geographyTag: typeof metadata.geographyTag === 'string' ? metadata.geographyTag : null,
  };
}

/**
 * Parse a PilotScope from raw query parameters.
 * Used in route handlers that accept ?pilot=&lane=&geo=
 */
export function parseScopeFromQuery(query: Record<string, unknown>): PilotScope {
  const str = (v: unknown) =>
    typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
  return {
    pilotId:      str(query.pilot)  ?? str(query.pilotId),
    workflowLane: str(query.lane)   ?? str(query.workflowLane),
    geographyTag: str(query.geo)    ?? str(query.geographyTag),
  };
}

/**
 * True when the scope has at least one non-null field.
 */
export function hasScope(scope: PilotScope): boolean {
  return scope.pilotId != null || scope.workflowLane != null || scope.geographyTag != null;
}
