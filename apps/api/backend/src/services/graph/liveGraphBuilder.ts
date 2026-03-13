/**
 * liveGraphBuilder.ts — Wave 247: Global Trust Graph Live Knowledge Network
 *
 * Builds live trust graphs from real data:
 *   - NPPES identity (via PersonProfile / VerificationArtifact source=NPPES)
 *   - CandidateCredentials
 *   - VerificationArtifacts (PSV check results)
 *   - Decision Capsules
 *   - Organizations (from Applications → Opportunities)
 *
 * Two main entry points:
 *   buildClinicianGraph(npi) → per-clinician subgraph
 *   buildNetworkGraph(options?) → global network overview
 */

import prisma from '../../graphql/prisma_client';
import { computeClinicianTrustState } from '../trust/trustStateEngine';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export type NodeType = 'clinician' | 'credential' | 'issuer' | 'hospital' | 'license';

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  trustLevel: string;   // L0–L3 or 'unknown'
  status: string;
  metadata?: Record<string, unknown>;
}

export type EdgeType =
  | 'VERIFIED_BY'   // credential → issuer
  | 'ACCEPTED_BY'   // capsule → org
  | 'DEPENDS_ON'    // credential → license
  | 'MONITORS'      // OIG → clinician
  | 'HAS_CREDENTIAL'; // clinician → credential

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  /** 0–1 — derived from trust score */
  weight: number;
  createdAt: string;
}

export interface TrustGraphStats {
  nodeCount: number;
  edgeCount: number;
  avgTrustScore: number;
}

export interface TrustGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: TrustGraphStats;
  generatedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sanitizeLabel(raw: unknown, fallback: string): string {
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return fallback;
}

function edgeId(source: string, target: string, type: string): string {
  return `${type}:${source}:${target}`;
}

function trustLevelFromScore(score: number): string {
  if (score >= 80) return 'L3';
  if (score >= 60) return 'L2';
  if (score >= 40) return 'L1';
  return 'L0';
}

function avgScore(scores: number[]): number {
  if (!scores.length) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

// ── buildClinicianGraph ───────────────────────────────────────────────────────

/**
 * Build a per-clinician trust subgraph from real database data.
 */
export async function buildClinicianGraph(npi: string): Promise<TrustGraph> {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const trustScores: number[] = [];

  // 1. Clinician node — compute trust state
  let clinicianTrustLevel = 'L0';
  let clinicianScore = 0;
  try {
    const state = await computeClinicianTrustState(npi);
    clinicianTrustLevel = state.readiness_level ?? state.trustBand ?? 'L0';
    clinicianScore = state.readiness_score ?? state.trustScore ?? 0;
    trustScores.push(clinicianScore);
  } catch (err) {
    log('warn', 'liveGraphBuilder: trust state unavailable', { npi, err: String(err) });
  }

  const clinicianNodeId = `clinician:${npi}`;
  nodes.push({
    id: clinicianNodeId,
    type: 'clinician',
    label: `NPI ${npi}`,
    trustLevel: clinicianTrustLevel,
    status: 'active',
  });

  // 2. VerificationArtifacts → credential + issuer nodes
  const artifacts = await prisma.verificationArtifact.findMany({
    where: { npi, lifecycleState: 'active' },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const issuerSet = new Set<string>();

  for (const art of artifacts) {
    const credId = `credential:${art.id}`;
    const credLabel = sanitizeLabel(
      (art.rawPayload as Record<string, unknown>)?.credentialType ?? art.source,
      `${art.source} credential`,
    );
    const credScore = art.trustState === 'trusted' ? 90 : art.trustState === 'verified' ? 70 : 40;
    trustScores.push(credScore);

    nodes.push({
      id: credId,
      type: 'credential',
      label: credLabel,
      trustLevel: trustLevelFromScore(credScore),
      status: art.status,
      metadata: {
        source: art.source,
        verifiedAt: art.verifiedAt?.toISOString(),
        expiresAt: art.expiresAt?.toISOString(),
      },
    });

    // clinician → credential
    edges.push({
      id: edgeId(clinicianNodeId, credId, 'HAS_CREDENTIAL'),
      source: clinicianNodeId,
      target: credId,
      type: 'HAS_CREDENTIAL',
      weight: credScore / 100,
      createdAt: art.createdAt.toISOString(),
    });

    // credential → issuer (source as issuer)
    const issuerId = `issuer:${art.source}`;
    if (!issuerSet.has(art.source)) {
      issuerSet.add(art.source);
      nodes.push({
        id: issuerId,
        type: 'issuer',
        label: art.source.toUpperCase(),
        trustLevel: 'L3',
        status: 'active',
      });
    }
    edges.push({
      id: edgeId(credId, issuerId, 'VERIFIED_BY'),
      source: credId,
      target: issuerId,
      type: 'VERIFIED_BY',
      weight: credScore / 100,
      createdAt: art.createdAt.toISOString(),
    });

    // OIG/LEIE artifacts → MONITORS edge
    if (art.source === 'OIG' || art.source === 'LEIE') {
      edges.push({
        id: edgeId(issuerId, clinicianNodeId, 'MONITORS'),
        source: issuerId,
        target: clinicianNodeId,
        type: 'MONITORS',
        weight: 0.8,
        createdAt: art.createdAt.toISOString(),
      });
    }

    // License-type credentials → license node + DEPENDS_ON
    if (art.source === 'NURSYS' || art.source === 'STATE_BOARD' || art.source.includes('LICENSE')) {
      const licenseId = `license:${art.id}`;
      nodes.push({
        id: licenseId,
        type: 'license',
        label: sanitizeLabel(
          (art.rawPayload as Record<string, unknown>)?.licenseNumber,
          `License (${art.source})`,
        ),
        trustLevel: trustLevelFromScore(credScore),
        status: art.status,
      });
      edges.push({
        id: edgeId(credId, licenseId, 'DEPENDS_ON'),
        source: credId,
        target: licenseId,
        type: 'DEPENDS_ON',
        weight: credScore / 100,
        createdAt: art.createdAt.toISOString(),
      });
    }
  }

  // 3. Decision Capsules → ACCEPTED_BY edges to hospital nodes
  const capsules = await prisma.decisionCapsule.findMany({
    where: { subjectNpi: npi },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  for (const capsule of capsules) {
    // Organization from metadata
    const meta = (capsule.metadata ?? {}) as Record<string, unknown>;
    const orgName = sanitizeLabel(meta.organizationName ?? meta.employerId, null as unknown as string);
    if (orgName) {
      const hospitalId = `hospital:${orgName.toLowerCase().replace(/\s+/g, '-')}`;
      const existingHospital = nodes.find(n => n.id === hospitalId);
      if (!existingHospital) {
        nodes.push({
          id: hospitalId,
          type: 'hospital',
          label: orgName,
          trustLevel: 'L2',
          status: 'active',
        });
      }

      edges.push({
        id: edgeId(clinicianNodeId, hospitalId, 'ACCEPTED_BY'),
        source: clinicianNodeId,
        target: hospitalId,
        type: 'ACCEPTED_BY',
        weight: capsule.status === 'VALID' ? 0.9 : 0.5,
        createdAt: capsule.createdAt.toISOString(),
      });
    }
  }

  // 4. CandidateCredentials — supplementary nodes
  const candidateCreds = await prisma.candidateCredential.findMany({
    where: { clinicianId: npi },
    take: 20,
  });

  for (const cc of candidateCreds) {
    const data = (cc.data ?? {}) as Record<string, unknown>;
    const credType = sanitizeLabel(data.credentialType ?? data.type, 'Credential');
    const credId = `cand-cred:${cc.id}`;
    const credScore = cc.status === 'VERIFIED' ? 75 : 40;
    trustScores.push(credScore);

    nodes.push({
      id: credId,
      type: 'credential',
      label: credType,
      trustLevel: trustLevelFromScore(credScore),
      status: cc.status,
      metadata: { source: 'candidate' },
    });

    edges.push({
      id: edgeId(clinicianNodeId, credId, 'HAS_CREDENTIAL'),
      source: clinicianNodeId,
      target: credId,
      type: 'HAS_CREDENTIAL',
      weight: credScore / 100,
      createdAt: cc.createdAt.toISOString(),
    });
  }

  // Deduplicate edges by id
  const edgeMap = new Map<string, GraphEdge>();
  for (const e of edges) edgeMap.set(e.id, e);
  const dedupedEdges = Array.from(edgeMap.values());

  const stats: TrustGraphStats = {
    nodeCount: nodes.length,
    edgeCount: dedupedEdges.length,
    avgTrustScore: avgScore(trustScores),
  };

  log('info', 'liveGraphBuilder: clinician graph built', { npi, ...stats });

  return { nodes, edges: dedupedEdges, stats, generatedAt: new Date().toISOString() };
}

// ── buildNetworkGraph ─────────────────────────────────────────────────────────

/**
 * Build a global network graph for homepage / network page consumption.
 * Aggregates clinicians, organizations, and federation entities.
 * Default limit: 200 nodes for performance.
 */
export async function buildNetworkGraph(options?: { limit?: number }): Promise<TrustGraph> {
  const limit = options?.limit ?? 200;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const trustScores: number[] = [];

  // Pull distinct NPIs from VerificationArtifacts (real data)
  const artifactGroups = await prisma.verificationArtifact.groupBy({
    by: ['npi'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: Math.floor(limit * 0.4),
  });

  const clinicianNpis = artifactGroups.map(g => g.npi).filter(Boolean);

  // Add clinician nodes
  for (const npi of clinicianNpis) {
    const nodeId = `clinician:${npi}`;
    nodes.push({
      id: nodeId,
      type: 'clinician',
      label: `NPI ${npi}`,
      trustLevel: 'L1',
      status: 'active',
    });
    trustScores.push(50);
  }

  // Pull distinct issuers
  const issuerGroups = await prisma.verificationArtifact.groupBy({
    by: ['source'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 20,
  });

  const issuerNames = issuerGroups.map(g => g.source);
  for (const src of issuerNames) {
    const issuerId = `issuer:${src}`;
    nodes.push({
      id: issuerId,
      type: 'issuer',
      label: src.toUpperCase(),
      trustLevel: 'L3',
      status: 'active',
    });
    trustScores.push(90);
  }

  // Build edges: sample of credential→issuer relationships
  const sampleArtifacts = await prisma.verificationArtifact.findMany({
    where: { lifecycleState: 'active' },
    select: { id: true, npi: true, source: true, createdAt: true, trustState: true },
    orderBy: { createdAt: 'desc' },
    take: Math.floor(limit * 0.6),
  });

  const clinicianSet = new Set(clinicianNpis);
  const issuerSet = new Set(issuerNames);

  for (const art of sampleArtifacts) {
    if (!clinicianSet.has(art.npi) || !issuerSet.has(art.source)) continue;
    const clinicianId = `clinician:${art.npi}`;
    const issuerId = `issuer:${art.source}`;
    const weight = art.trustState === 'trusted' ? 0.9 : art.trustState === 'verified' ? 0.7 : 0.4;

    edges.push({
      id: edgeId(clinicianId, issuerId, 'VERIFIED_BY'),
      source: clinicianId,
      target: issuerId,
      type: 'VERIFIED_BY',
      weight,
      createdAt: art.createdAt.toISOString(),
    });
  }

  // Decision capsules → hospital organizations
  const capsuleSample = await prisma.decisionCapsule.findMany({
    select: { id: true, subjectNpi: true, metadata: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  const hospitalSet = new Set<string>();
  for (const cap of capsuleSample) {
    const meta = (cap.metadata ?? {}) as Record<string, unknown>;
    const orgName = typeof meta.organizationName === 'string' ? meta.organizationName
      : typeof meta.employerId === 'string' ? meta.employerId : null;
    if (!orgName) continue;

    const hospitalId = `hospital:${orgName.toLowerCase().replace(/\s+/g, '-')}`;
    if (!hospitalSet.has(hospitalId)) {
      hospitalSet.add(hospitalId);
      nodes.push({
        id: hospitalId,
        type: 'hospital',
        label: orgName,
        trustLevel: 'L2',
        status: 'active',
      });
      trustScores.push(70);
    }

    if (clinicianSet.has(cap.subjectNpi)) {
      edges.push({
        id: edgeId(`clinician:${cap.subjectNpi}`, hospitalId, 'ACCEPTED_BY'),
        source: `clinician:${cap.subjectNpi}`,
        target: hospitalId,
        type: 'ACCEPTED_BY',
        weight: cap.status === 'VALID' ? 0.9 : 0.5,
        createdAt: cap.createdAt.toISOString(),
      });
    }
  }

  // Deduplicate
  const edgeMap = new Map<string, GraphEdge>();
  for (const e of edges) edgeMap.set(e.id, e);
  const dedupedEdges = Array.from(edgeMap.values());

  const stats: TrustGraphStats = {
    nodeCount: nodes.length,
    edgeCount: dedupedEdges.length,
    avgTrustScore: avgScore(trustScores),
  };

  log('info', 'liveGraphBuilder: network graph built', { ...stats });

  return { nodes, edges: dedupedEdges, stats, generatedAt: new Date().toISOString() };
}

// ── expandNode ────────────────────────────────────────────────────────────────

/**
 * Expand a single node — returns its immediate neighborhood.
 * nodeId format: "type:id"
 */
export async function expandNode(nodeId: string): Promise<TrustGraph> {
  const [type, ...rest] = nodeId.split(':');
  const id = rest.join(':');

  if (type === 'clinician') {
    return buildClinicianGraph(id);
  }

  // For other node types, build a minimal subgraph around this node
  const nodes: GraphNode[] = [{
    id: nodeId,
    type: type as NodeType,
    label: id,
    trustLevel: 'L2',
    status: 'active',
  }];

  // Find artifacts related to this issuer/source
  if (type === 'issuer') {
    const artifacts = await prisma.verificationArtifact.findMany({
      where: { source: id, lifecycleState: 'active' },
      select: { npi: true, id: true, createdAt: true, trustState: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const seen = new Set<string>();
    const edges: GraphEdge[] = [];
    for (const art of artifacts) {
      const clinId = `clinician:${art.npi}`;
      if (!seen.has(art.npi)) {
        seen.add(art.npi);
        nodes.push({
          id: clinId,
          type: 'clinician',
          label: `NPI ${art.npi}`,
          trustLevel: 'L1',
          status: 'active',
        });
      }
      edges.push({
        id: edgeId(clinId, nodeId, 'VERIFIED_BY'),
        source: clinId,
        target: nodeId,
        type: 'VERIFIED_BY',
        weight: art.trustState === 'trusted' ? 0.9 : 0.6,
        createdAt: art.createdAt.toISOString(),
      });
    }

    const edgeMap = new Map<string, GraphEdge>();
    for (const e of edges) edgeMap.set(e.id, e);
    const dedupedEdges = Array.from(edgeMap.values());

    return {
      nodes,
      edges: dedupedEdges,
      stats: { nodeCount: nodes.length, edgeCount: dedupedEdges.length, avgTrustScore: 70 },
      generatedAt: new Date().toISOString(),
    };
  }

  return {
    nodes,
    edges: [],
    stats: { nodeCount: 1, edgeCount: 0, avgTrustScore: 0 },
    generatedAt: new Date().toISOString(),
  };
}
