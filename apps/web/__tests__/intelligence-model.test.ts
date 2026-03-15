import { describe, expect, it } from 'vitest';
import type { GraphEdge, GraphNode } from '@/components/graph-system/types';
import { resolveEdgeStrength, resolveGraphZoomBand } from '@/components/graph-system/viewportModel';
import {
  buildAlertSummaries,
  buildProviderProfiles,
  buildVerificationRunSummary,
  findBestMatchingNode,
} from '@/components/intelligence/intelligenceModel';

const nodes: GraphNode[] = [
  {
    id: 'clinician:ada',
    type: 'clinician',
    label: 'Dr. Ada Lovelace',
    title: 'Ada Lovelace',
    color: '#ffffff',
    group: 'cardiology',
    degree: 8,
    inDegree: 4,
    outDegree: 4,
    layer: 'blended',
    metadata: {
      specialty: 'Cardiology',
      institution: 'Mayo Clinic',
      state: 'MN',
    },
    tags: ['cardiology', 'mayo'],
    sourceRefs: ['nppes', 'pecos'],
    trustTier: 'GOLD',
    trustBand: 'L3',
    confidence: 0.93,
    createdAt: '2026-03-01T08:00:00.000Z',
    updatedAt: '2026-03-10T10:00:00.000Z',
  },
  {
    id: 'clinician:grace',
    type: 'clinician',
    label: 'Dr. Grace Hopper',
    title: 'Grace Hopper',
    color: '#ffffff',
    group: 'neurology',
    degree: 3,
    inDegree: 1,
    outDegree: 2,
    layer: 'blended',
    metadata: {
      specialty: 'Neurology',
      institution: 'General Hospital',
      state: 'CA',
    },
    tags: ['neurology'],
    sourceRefs: ['state-board'],
    trustTier: 'BRONZE',
    trustBand: 'L1',
    confidence: 0.58,
    createdAt: '2026-03-01T08:00:00.000Z',
    updatedAt: '2026-03-10T10:00:00.000Z',
  },
];

const edges: GraphEdge[] = [
  {
    id: 'edge-trust',
    source: 'clinician:ada',
    target: 'org:mayo',
    type: 'verified_by',
    directed: true,
    reciprocal: false,
    confidence: 0.96,
    createdBy: 'system',
    explanation: 'Registry verification matched.',
    status: 'active',
    weight: 0.92,
    metadata: {},
    layer: 'trust',
    createdAt: '2026-03-10T10:00:00.000Z',
    updatedAt: '2026-03-10T10:00:00.000Z',
  },
  {
    id: 'edge-ai',
    source: 'clinician:grace',
    target: 'source:oig',
    type: 'ai_suggested_link',
    directed: false,
    reciprocal: true,
    confidence: 0.55,
    createdBy: 'ai',
    explanation: 'Potential sanctions signal.',
    status: 'pending',
    weight: 0.48,
    metadata: {},
    layer: 'trust',
    createdAt: '2026-03-11T10:00:00.000Z',
    updatedAt: '2026-03-11T10:00:00.000Z',
  },
];

describe('intelligenceModel', () => {
  it('builds provider summaries and alert pressure from graph data', () => {
    const profiles = buildProviderProfiles(nodes, edges);
    const alerts = buildAlertSummaries(nodes, edges);

    expect(profiles[0]?.title).toBe('Ada Lovelace');
    expect(profiles[0]?.evidenceCount).toBeGreaterThan(2);
    expect(alerts.some((alert) => alert.nodeId === 'clinician:grace')).toBe(true);
  });

  it('matches provider queries and derives verification state', () => {
    const matchedNode = findBestMatchingNode('ada', nodes);
    const profiles = buildProviderProfiles(nodes, edges);
    const verification = buildVerificationRunSummary({
      target: 'Ada Lovelace',
      matchedProfile: profiles.find((profile) => profile.id === matchedNode?.id) ?? null,
      alerts: [],
    });

    expect(matchedNode?.id).toBe('clinician:ada');
    expect(verification.status).toBe('ready');
    expect(verification.score).toBe(93);
  });
});

describe('viewportModel', () => {
  it('maps zoom into semantic bands and encodes edge strength', () => {
    expect(resolveGraphZoomBand(0.7)).toBe('overview');
    expect(resolveGraphZoomBand(1)).toBe('network');
    expect(resolveGraphZoomBand(1.7)).toBe('evidence');
    expect(resolveEdgeStrength(edges[0]!)).toBeGreaterThan(resolveEdgeStrength(edges[1]!));
  });
});
