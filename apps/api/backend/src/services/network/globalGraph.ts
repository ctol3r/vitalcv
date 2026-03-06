/**
 * globalGraph.ts — Wave 96: Global Trust Network Graph
 *
 * Aggregates clinicians, issuers, credentials, and decisions into
 * a unified graph payload for the GlobalTrustMap visualization.
 */

import prisma from '../../graphql/prisma_client';
import { listIssuers } from '../registry/trustRegistry';
import { listAllCredentials } from '../credentials/credentialWallet';
import { getFederatedGraphNodes } from './federation';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────

export type GlobalNodeGroup = 'clinician' | 'issuer' | 'credential' | 'decision' | 'federated_issuer';

export interface GlobalNode {
  id: string;
  label: string;
  group: GlobalNodeGroup;
  /** Relative visual size (connection count) */
  val: number;
  /** Wave 105: trust score 0–100 for issuer nodes */
  trustScore?: number;
  metadata?: Record<string, unknown>;
}

export interface GlobalEdge {
  source: string;
  target: string;
  label: string;
  weight?: number;
}

export interface GlobalGraphData {
  nodes: GlobalNode[];
  edges: GlobalEdge[];
  stats: {
    clinicians: number;
    issuers: number;
    credentials: number;
    decisions: number;
    totalNodes: number;
    totalEdges: number;
  };
  generatedAt: string;
}

// ── Generator ─────────────────────────────────────────────────────────

export async function generateGlobalGraph(): Promise<GlobalGraphData> {
  const nodes: GlobalNode[] = [];
  const edges: GlobalEdge[] = [];
  const nodeIds = new Set<string>();

  const addNode = (node: GlobalNode): void => {
    if (!nodeIds.has(node.id)) {
      nodeIds.add(node.id);
      nodes.push(node);
    }
  };

  // ── 1. Clinicians (from Prisma) ─────────────────────────────────────
  let providers: Array<{ npi: string; fullName: string }> = [];
  try {
    providers = await prisma.provider.findMany({
      take: 80,
      orderBy: { createdAt: 'desc' },
      select: { npi: true, fullName: true },
    });
  } catch {
    log('warn', 'global_graph_provider_fetch_failed', {});
  }

  for (const p of providers) {
    addNode({
      id: `clinician-${p.npi}`,
      label: p.fullName ?? p.npi,
      group: 'clinician',
      val: 3,
      metadata: { npi: p.npi },
    });
  }

  // ── 2. Trusted Issuers (from in-memory registry) ────────────────────
  const issuers = listIssuers();
  for (const issuer of issuers) {
    addNode({
      id: `issuer-${issuer.issuerId}`,
      label: issuer.issuerName,
      group: 'issuer',
      val: 6,
      // Wave 105: expose trust score for canvas coloring
      ...(issuer.trustScore != null && { trustScore: issuer.trustScore }),
      metadata: {
        issuerId: issuer.issuerId,
        trustLevel: issuer.trustLevel,
        status: issuer.status,
        trustScore: issuer.trustScore,
        verificationCount: issuer.verificationCount,
        revocationCount: issuer.revocationCount,
      },
    });
  }

  // ── 3. Credentials (from in-memory wallet) ──────────────────────────
  const credentials = listAllCredentials();
  for (const cred of credentials.slice(0, 100)) {
    const credNodeId = `credential-${cred.credentialId}`;
    addNode({
      id: credNodeId,
      label: `Credential ${cred.credentialId.slice(0, 8)}`,
      group: 'credential',
      val: 2,
      metadata: {
        credentialId: cred.credentialId,
        status: cred.status,
        issuedAt: cred.issuedAt,
      },
    });

    // Edge: issuer → credential
    const issuerNodeId = `issuer-${cred.issuer}`;
    if (nodeIds.has(issuerNodeId)) {
      edges.push({ source: issuerNodeId, target: credNodeId, label: 'issued', weight: 1 });
    }

    // Edge: credential → clinician
    const clinicianNodeId = `clinician-${cred.subject}`;
    if (nodeIds.has(clinicianNodeId)) {
      edges.push({ source: credNodeId, target: clinicianNodeId, label: 'held_by', weight: 1 });
    }
  }

  // ── 4. Decisions + verification artifacts (from Prisma) ─────────────
  let artifacts: Array<{ npi: string; source: string }> = [];
  try {
    artifacts = await prisma.verificationArtifact.findMany({
      take: 200,
      orderBy: { createdAt: 'desc' },
      select: { npi: true, source: true },
    });
  } catch {
    log('warn', 'global_graph_artifact_fetch_failed', {});
  }

  // Group artifacts by source (issuer proxy)
  const sourceMap = new Map<string, string[]>();
  for (const a of artifacts) {
    if (!sourceMap.has(a.source)) sourceMap.set(a.source, []);
    sourceMap.get(a.source)!.push(a.npi);
  }

  for (const [source, npis] of sourceMap.entries()) {
    const sourceNodeId = `issuer-src-${source}`;
    if (!nodeIds.has(sourceNodeId)) {
      addNode({
        id: sourceNodeId,
        label: source,
        group: 'issuer',
        val: 4,
        metadata: { type: 'verification_source' },
      });
    }

    // Only connect to first 10 clinicians per source to avoid edge explosion
    for (const npi of npis.slice(0, 10)) {
      const clinicianNodeId = `clinician-${npi}`;
      if (nodeIds.has(clinicianNodeId)) {
        edges.push({
          source: sourceNodeId,
          target: clinicianNodeId,
          label: 'verified',
          weight: 1,
        });
      }
    }
  }

  // ── 5. Decisions (from Prisma) ──────────────────────────────────────
  let decisions: Array<{ id: string; subjectId: string; employerId: string }> = [];
  try {
    decisions = await prisma.acceptance.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      select: { id: true, subjectId: true, employerId: true },
    });
  } catch {
    log('warn', 'global_graph_decision_fetch_failed', {});
  }

  for (const d of decisions) {
    const decisionNodeId = `decision-${d.id}`;
    addNode({
      id: decisionNodeId,
      label: `Acceptance ${d.id.slice(0, 8)}`,
      group: 'decision',
      val: 2,
      metadata: { employerId: d.employerId },
    });

    const clinicianNodeId = `clinician-${d.subjectId}`;
    if (nodeIds.has(clinicianNodeId)) {
      edges.push({ source: clinicianNodeId, target: decisionNodeId, label: 'received', weight: 1 });
    }
  }

  // ── 6. Federated network nodes (Wave 102) ─────────────────────────
  const federatedNodes = getFederatedGraphNodes();
  for (const fn of federatedNodes) {
    addNode({
      id: fn.id,
      label: fn.label,
      group: fn.group,
      val: fn.val,
      metadata: {
        networkId: fn.networkId,
        endpoint: fn.endpoint,
        status: fn.status,
        external: true,
      },
    });
  }

  const statsClinicans = nodes.filter((n) => n.group === 'clinician').length;
  const statsIssuers = nodes.filter((n) => n.group === 'issuer' || n.group === 'federated_issuer').length;
  const statsCredentials = nodes.filter((n) => n.group === 'credential').length;
  const statsDecisions = nodes.filter((n) => n.group === 'decision').length;

  log('info', 'global_graph_generated', {
    nodes: nodes.length,
    edges: edges.length,
  });

  return {
    nodes,
    edges,
    stats: {
      clinicians: statsClinicans,
      issuers: statsIssuers,
      credentials: statsCredentials,
      decisions: statsDecisions,
      totalNodes: nodes.length,
      totalEdges: edges.length,
    },
    generatedAt: new Date().toISOString(),
  };
}
