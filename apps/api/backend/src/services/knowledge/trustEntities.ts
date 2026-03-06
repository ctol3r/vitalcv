/**
 * trustEntities.ts — Trust Entity Model for VitalCV Knowledge Protocol
 *
 * Defines the core entity types that participate in the trust graph:
 * clinicians, credentials, issuers, verifiers, and decisions.
 */

// ── Entity Types ─────────────────────────────────────────────────────

export const TRUST_ENTITY_TYPES = ['clinician', 'credential', 'issuer', 'verifier', 'decision'] as const;

export type TrustEntityType = (typeof TRUST_ENTITY_TYPES)[number];

// ── Entity Interface ─────────────────────────────────────────────────

export interface TrustEntity {
  id: string;
  type: TrustEntityType;
  label: string;
  trustScore: number; // 0–1
  centrality: number; // 0–1, graph centrality score
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ── Factory ──────────────────────────────────────────────────────────

export function createTrustEntity(
  type: TrustEntityType,
  id: string,
  label: string,
  metadata: Record<string, unknown> = {},
): TrustEntity {
  return {
    id,
    type,
    label,
    trustScore: 0,
    centrality: 0,
    metadata,
    createdAt: new Date().toISOString(),
  };
}
