/**
 * trustRelationships.ts — Trust Relationship Types for the Knowledge Protocol
 *
 * Defines semantic relationship types between entities in the trust graph,
 * complementing the edge types in graphEngine.ts.
 */

import { randomUUID } from 'crypto';

// ── Types ─────────────────────────────────────────────────────────────

export const TRUST_RELATIONSHIP_TYPES = ['ISSUED_BY', 'VERIFIED_BY', 'DEPENDS_ON', 'AUTHORIZED_BY', 'MONITORED_BY'] as const;

export type TrustRelationshipType = (typeof TRUST_RELATIONSHIP_TYPES)[number];

export interface TrustRelationship {
  id: string;
  type: TrustRelationshipType;
  sourceId: string;
  targetId: string;
  weight: number;
  confidence: number;
  metadata: Record<string, unknown>;
}

// ── Semantics ─────────────────────────────────────────────────────────

export const RELATIONSHIP_SEMANTICS: Record<
  TrustRelationshipType,
  { label: string; description: string; bidirectional: boolean }
> = {
  ISSUED_BY: {
    label: 'Issued By',
    description: 'A credential was issued by an authority or organization.',
    bidirectional: false,
  },
  VERIFIED_BY: {
    label: 'Verified By',
    description: 'An entity or credential was verified by a trusted source.',
    bidirectional: false,
  },
  DEPENDS_ON: {
    label: 'Depends On',
    description: 'A decision or credential depends on another entity for validity.',
    bidirectional: false,
  },
  AUTHORIZED_BY: {
    label: 'Authorized By',
    description: 'An action or decision was authorized by a governing authority.',
    bidirectional: false,
  },
  MONITORED_BY: {
    label: 'Monitored By',
    description: 'An entity is under continuous monitoring by a trust daemon or watcher.',
    bidirectional: true,
  },
};

// ── Factory ───────────────────────────────────────────────────────────

export function createTrustRelationship(
  type: TrustRelationshipType,
  sourceId: string,
  targetId: string,
  weight: number = 1,
  confidence: number = 1,
): TrustRelationship {
  return {
    id: randomUUID(),
    type,
    sourceId,
    targetId,
    weight,
    confidence,
    metadata: {},
  };
}
