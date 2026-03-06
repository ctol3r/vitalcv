/**
 * graphEngine.ts — Wave 82: Trust Graph Intelligence Engine
 *
 * Enhanced graph generator that returns typed nodes (clinician, issuer,
 * credential, decision, employer) and semantic edges (issued_by,
 * verified_by, depends_on, authorized_by).
 *
 * Reads from Prisma — no schema changes required.
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────

export type NodeGroup = 'clinician' | 'issuer' | 'credential' | 'decision' | 'employer';

export interface IntelligentNode {
  id: string;
  label: string;
  group: NodeGroup;
  status?: string;
  trustState?: string;
  auditHash?: string | null;
  decisionRisk?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  decisionConfidence?: number;
  /** Aggregate trust weight for issuer nodes (0–1, derived from credential health). */
  issuerTrustWeight?: number;
  /** Number of credentials this entity depends on (for decision nodes). */
  credentialDependencyCount?: number;
  val: number;
  metadata?: Record<string, unknown>;
}

export interface IntelligentEdge {
  source: string;
  target: string;
  label: 'issued_by' | 'verified_by' | 'depends_on' | 'authorized_by' | 'employed_at';
  weight?: number;
}

/** Wave 92 enrichment summary surfaced in the graph response. */
export interface GraphEnrichment {
  issuerTrustWeights: Record<string, number>;
  credentialDependencies: Record<string, string[]>;
  decisionConfidences: Record<string, number>;
}

export interface IntelligentGraph {
  npi: string;
  nodes: IntelligentNode[];
  edges: IntelligentEdge[];
  enrichment: GraphEnrichment;
  generatedAt: string;
}

// ── Risk Classification ───────────────────────────────────────────────

function classifyNodeRisk(status?: string, trustState?: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (status === 'REVOKED' || status === 'SUSPENDED') return 'CRITICAL';
  if (status === 'EXPIRED' || trustState === 'expired') return 'HIGH';
  if (trustState === 'monitoring' || trustState === 'expiring') return 'MEDIUM';
  return 'LOW';
}

// ── Core Generator ────────────────────────────────────────────────────

export async function generateTrustGraph(npi: string): Promise<IntelligentGraph> {
  const [artifacts, acceptances, capsules] = await Promise.all([
    prisma.verificationArtifact.findMany({
      where: { npi },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.acceptance.findMany({
      where: { subjectId: npi },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditEvent.findMany({
      where: { type: 'DECISION_CAPSULE', clinicianId: npi },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  const nodes: IntelligentNode[] = [];
  const edges: IntelligentEdge[] = [];

  // Clinician node
  const clinicianId = `clinician-${npi}`;
  nodes.push({ id: clinicianId, label: `Clinician ${npi}`, group: 'clinician', val: 20 });

  // Employers from acceptances
  const employerIds = new Set<string>();
  for (const acc of acceptances) {
    const empNodeId = `employer-${acc.employerId}`;
    if (!employerIds.has(empNodeId)) {
      employerIds.add(empNodeId);
      nodes.push({ id: empNodeId, label: acc.employerId, group: 'employer', val: 15 });
      edges.push({ source: clinicianId, target: empNodeId, label: 'employed_at' });
    }
  }

  // Issuers + Credentials from artifacts
  const issuerIds = new Set<string>();
  for (const art of artifacts) {
    const issuerNodeId = `issuer-${art.source.replace(/\s+/g, '-')}`;
    if (!issuerIds.has(issuerNodeId)) {
      issuerIds.add(issuerNodeId);
      nodes.push({ id: issuerNodeId, label: art.source, group: 'issuer', val: 15 });
      edges.push({ source: issuerNodeId, target: clinicianId, label: 'verified_by' });
    }

    const credId = `cred-${art.id}`;
    const risk = classifyNodeRisk(art.status, art.trustState);
    nodes.push({
      id: credId,
      label: art.source.includes(':') ? art.source.split(':').pop()! : 'Credential',
      group: 'credential',
      status: art.status,
      trustState: art.trustState,
      auditHash: art.merkleRoot ?? art.checksum,
      decisionRisk: risk,
      val: 10,
    });

    // Issuer trust weight: degraded for revoked/suspended credentials
    const issuerTrustWeight = (art.status === 'REVOKED' || art.status === 'SUSPENDED') ? 0.1
      : art.status === 'EXPIRED' ? 0.3
      : art.trustState === 'expiring' ? 0.7
      : 1.0;

    edges.push({ source: issuerNodeId, target: credId, label: 'issued_by', weight: issuerTrustWeight });
    edges.push({ source: credId, target: clinicianId, label: 'verified_by', weight: issuerTrustWeight });
  }

  // Decision capsule nodes (stored as AuditEvent with metadata)
  for (const cap of capsules) {
    const meta = (cap.metadata ?? {}) as Record<string, unknown>;
    const decisionType = typeof meta['decisionType'] === 'string' ? meta['decisionType'] : 'UNKNOWN';
    const capStatus = typeof meta['status'] === 'string' ? meta['status'] : 'VALID';
    const credentialIds = Array.isArray(meta['credentialIds']) ? meta['credentialIds'] as string[] : [];
    const issuerIdsList = Array.isArray(meta['issuerIds']) ? meta['issuerIds'] as string[] : [];

    const decId = `decision-${cap.id}`;

    // Decision confidence derived from dependent credential health
    const depCredIds = credentialIds.map((cid) => `cred-${cid}`);
    const depCreds = depCredIds.map((cid) => nodes.find((n) => n.id === cid)).filter(Boolean) as IntelligentNode[];
    const healthyDeps = depCreds.filter((n) => n.decisionRisk === 'LOW' || n.decisionRisk === 'MEDIUM');
    const decisionConfidence = depCreds.length > 0
      ? healthyDeps.length / depCreds.length
      : capStatus === 'INVALID' ? 0.1 : capStatus === 'AT_RISK' ? 0.5 : 0.85;

    nodes.push({
      id: decId,
      label: `${decisionType} (${capStatus})`,
      group: 'decision',
      status: capStatus,
      decisionRisk: capStatus === 'INVALID' ? 'CRITICAL' : capStatus === 'AT_RISK' ? 'HIGH' : 'LOW',
      decisionConfidence,
      val: 12,
      metadata: { decisionType, artifactHash: cap.hash, credentialDependencyCount: depCreds.length },
    });

    // Decisions depend on credentials
    for (const credRefId of credentialIds) {
      const matchingCred = nodes.find((n) => n.id === `cred-${credRefId}`);
      if (matchingCred) {
        edges.push({ source: decId, target: matchingCred.id, label: 'depends_on' });
      }
    }

    // Decisions authorized by issuers
    for (const issuerId of issuerIdsList) {
      const matchingIssuer = nodes.find((n) => n.id.startsWith('issuer-') && n.id.includes(issuerId));
      if (matchingIssuer) {
        edges.push({ source: matchingIssuer.id, target: decId, label: 'authorized_by' });
      }
    }
  }

  // Fallback demo data for empty NPI
  if (nodes.length === 1) {
    nodes.push(
      { id: 'issuer-state-board', label: 'State Medical Board', group: 'issuer', val: 15 },
      { id: 'cred-license', label: 'State License', group: 'credential', status: 'Valid', trustState: 'GREEN', auditHash: 'demo-hash', decisionRisk: 'LOW', val: 10 },
      { id: 'employer-hospital', label: 'General Hospital', group: 'employer', val: 15 },
      { id: 'decision-hire', label: 'HIRING (VALID)', group: 'decision', status: 'VALID', decisionRisk: 'LOW', decisionConfidence: 0.92, val: 12 },
    );
    edges.push(
      { source: 'issuer-state-board', target: clinicianId, label: 'verified_by' },
      { source: 'issuer-state-board', target: 'cred-license', label: 'issued_by' },
      { source: 'cred-license', target: clinicianId, label: 'verified_by' },
      { source: clinicianId, target: 'employer-hospital', label: 'employed_at' },
      { source: 'decision-hire', target: 'cred-license', label: 'depends_on' },
      { source: 'issuer-state-board', target: 'decision-hire', label: 'authorized_by' },
    );
  }

  // ── Wave 92: Enrichment pass ──────────────────────────────────────────
  const issuerTrustWeights: Record<string, number> = {};
  const credentialDependencies: Record<string, string[]> = {};
  const decisionConfidences: Record<string, number> = {};

  // Compute aggregate issuer trust weight from their issued edges
  for (const issuerNode of nodes.filter((n) => n.group === 'issuer')) {
    const issuedEdges = edges.filter(
      (e) => e.source === issuerNode.id && e.label === 'issued_by',
    );
    const avgWeight =
      issuedEdges.length > 0
        ? issuedEdges.reduce((s, e) => s + (e.weight ?? 1), 0) / issuedEdges.length
        : 1.0;
    issuerNode.issuerTrustWeight = avgWeight;
    issuerTrustWeights[issuerNode.id] = avgWeight;
  }

  // Collect credential dependencies and decision confidences
  for (const decNode of nodes.filter((n) => n.group === 'decision')) {
    const depEdges = edges.filter(
      (e) => e.source === decNode.id && e.label === 'depends_on',
    );
    const depIds = depEdges.map((e) => e.target);
    decNode.credentialDependencyCount = depIds.length;
    credentialDependencies[decNode.id] = depIds;
    if (decNode.decisionConfidence != null) {
      decisionConfidences[decNode.id] = decNode.decisionConfidence;
    }
  }

  const enrichment: GraphEnrichment = {
    issuerTrustWeights,
    credentialDependencies,
    decisionConfidences,
  };

  log('info', 'graph_engine: generated', { npi, nodeCount: nodes.length, edgeCount: edges.length });

  return { npi, nodes, edges, enrichment, generatedAt: new Date().toISOString() };
}
