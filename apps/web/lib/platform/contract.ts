/**
 * VitalCV Platform API contract (Wave 330) — the stable, versioned public surface
 * for enterprise integrations.
 *
 * C1 (boundaries): PLATFORM_ENDPOINTS is the explicit, read-only public surface —
 * the source-backed projection APIs. Anything not listed here is NOT a platform
 * contract. C2 (versioning): every endpoint declares its `schema` version; the
 * platform version is pinned. Pure types/data — no I/O.
 */

import type {
  EvidenceCollection,
  IntelligenceProjection,
  MobilityOverview,
  OrganizationGraph,
  ReadinessProjection,
  TimelineProjection,
  TrustProjection,
} from '@vitalcv/domain-evidence';

export const PLATFORM_API_VERSION = 'v1' as const;

/** Every platform response is this envelope: a versioned schema + the projection. */
export type PlatformEnvelope<T> = { schema: string } & T;
export interface PlatformErrorEnvelope {
  error: string;
  error_description: string;
}

export interface PlatformEndpoint {
  id: string;
  /** Path template; `:entityId` is a canonicalId or 10-digit NPI. */
  path: string;
  method: 'GET';
  schema: `vitalcv.${string}.v1`;
  /** Public = part of the stable enterprise contract. */
  visibility: 'public';
}

export const PLATFORM_ENDPOINTS = [
  { id: 'evidence', path: '/api/evidence/:entityId', method: 'GET', schema: 'vitalcv.evidence-collection.v1', visibility: 'public' },
  { id: 'trust', path: '/api/graph/:entityId/trust', method: 'GET', schema: 'vitalcv.evidence-graph-trust.v1', visibility: 'public' },
  { id: 'timeline', path: '/api/timeline/:entityId', method: 'GET', schema: 'vitalcv.timeline.v1', visibility: 'public' },
  { id: 'mobility', path: '/api/mobility/:entityId', method: 'GET', schema: 'vitalcv.mobility.v1', visibility: 'public' },
  { id: 'mobility-readiness', path: '/api/mobility/:entityId/readiness', method: 'GET', schema: 'vitalcv.mobility-readiness.v1', visibility: 'public' },
  { id: 'organizations', path: '/api/organizations/:entityId', method: 'GET', schema: 'vitalcv.organizations.v1', visibility: 'public' },
  { id: 'intelligence', path: '/api/career-intelligence/:entityId', method: 'GET', schema: 'vitalcv.career-intelligence.v1', visibility: 'public' },
] as const satisfies readonly PlatformEndpoint[];

export type PlatformEndpointId = (typeof PLATFORM_ENDPOINTS)[number]['id'];

/** Map an endpoint id to its concrete path for an entity. entityId is URL-encoded. */
export function platformPath(id: PlatformEndpointId, entityId: string): string {
  const ep = PLATFORM_ENDPOINTS.find((e) => e.id === id);
  if (!ep) throw new Error(`Unknown platform endpoint: ${id}`);
  return ep.path.replace(':entityId', encodeURIComponent(entityId));
}

/** True if a response schema is a recognized, current platform contract version. */
export function isPlatformSchema(schema: unknown): schema is `vitalcv.${string}.v1` {
  return typeof schema === 'string' && /^vitalcv\.[a-z-]+\.v1$/.test(schema);
}

/** The typed payload returned by each platform endpoint (sans envelope `schema`). */
export interface PlatformResponseTypes {
  evidence: EvidenceCollection;
  trust: TrustProjection;
  timeline: TimelineProjection;
  mobility: MobilityOverview;
  'mobility-readiness': ReadinessProjection;
  organizations: OrganizationGraph;
  intelligence: IntelligenceProjection;
}
