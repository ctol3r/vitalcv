/**
 * useKnowledgeGraph.ts — Wave 93
 *
 * Polls GET /api/knowledge/:npi and shapes response into the
 * KnowledgeExplorer entity/relationship format.
 */

'use client';

import { useMemo } from 'react';
import { useApi } from './useApi';

// ── API Response types (matches TrustKnowledgeGraph on backend) ───────

interface ApiEntity {
  id: string;
  type: 'clinician' | 'credential' | 'issuer' | 'verifier' | 'decision';
  label: string;
  trustScore: number;
  centrality: number;
  metadata: Record<string, unknown>;
}

interface ApiRelationship {
  id: string;
  type: string;
  sourceId: string;
  targetId: string;
  weight: number;
  confidence: number;
  metadata?: Record<string, unknown>;
}

interface KnowledgeGraphResponse {
  npi: string;
  nodes: ApiEntity[];
  edges: ApiRelationship[];
  generatedAt: string;
}

// ── Hook ──────────────────────────────────────────────────────────────

export function useKnowledgeGraph(npi: string | null, intervalMs = 60_000) {
  const url = npi ? `/api/knowledge/${npi}` : null;
  const { data, loading, error, refresh, lastUpdated } =
    useApi<KnowledgeGraphResponse>(url, { interval: intervalMs });

  // Shape edges: backend uses `edges`, explorer calls them `relationships`
  const relationships = useMemo(
    () =>
      (data?.edges ?? []).map((e) => ({
        id: e.id,
        type: e.type,
        sourceId: e.sourceId,
        targetId: e.targetId,
        weight: e.weight,
        confidence: e.confidence,
      })),
    [data?.edges],
  );

  return {
    entities: data?.nodes ?? null,
    relationships,
    loading,
    error,
    refresh,
    lastUpdated,
    generatedAt: data?.generatedAt ?? null,
  };
}
