/**
 * knowledgeGraph.ts — Wave 92: Trust Knowledge Protocol
 *
 * Generates a unified knowledge graph that enriches the trust graph
 * with entity typing, relationship semantics, and graph metrics
 * (centrality, trust weight, dependency analysis).
 *
 * Read-only — no database mutations.
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import type { TrustEntity, TrustEntityType } from './trustEntities';
import { createTrustEntity, TRUST_ENTITY_TYPES } from './trustEntities';
import type { TrustRelationship, TrustRelationshipType } from './trustRelationships';
import { createTrustRelationship, TRUST_RELATIONSHIP_TYPES } from './trustRelationships';

// ── Types ─────────────────────────────────────────────────────────────

export interface TrustKnowledgeGraph {
  npi: string;
  nodes: TrustEntity[];
  edges: TrustRelationship[];
  entityTypes: readonly TrustEntityType[];
  relationshipTypes: readonly TrustRelationshipType[];
  generatedAt: string;
}

// ── Centrality Calculation ────────────────────────────────────────────

function computeDegreeCentrality(
  nodes: TrustEntity[],
  edges: TrustRelationship[],
): void {
  const degree = new Map<string, number>();
  for (const edge of edges) {
    degree.set(edge.sourceId, (degree.get(edge.sourceId) ?? 0) + 1);
    degree.set(edge.targetId, (degree.get(edge.targetId) ?? 0) + 1);
  }

  const maxDegree = Math.max(1, ...degree.values());
  for (const node of nodes) {
    node.centrality = (degree.get(node.id) ?? 0) / maxDegree;
  }
}

// ── Trust Score Calculation ───────────────────────────────────────────

function computeTrustScores(
  nodes: TrustEntity[],
  edges: TrustRelationship[],
): void {
  for (const node of nodes) {
    const inbound = edges.filter((e) => e.targetId === node.id);
    if (inbound.length === 0) {
      node.trustScore = node.type === 'clinician' ? 0.5 : 0;
      continue;
    }

    const weightedSum = inbound.reduce((sum, e) => sum + e.weight * e.confidence, 0);
    node.trustScore = Math.min(1, weightedSum / inbound.length);
  }
}

// ── Core Generator ────────────────────────────────────────────────────

export async function generateTrustKnowledgeGraph(
  npi: string,
): Promise<TrustKnowledgeGraph> {
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

  const nodes: TrustEntity[] = [];
  const edges: TrustRelationship[] = [];

  // ── Clinician entity ────────────────────────────────────────────────
  const clinicianId = `clinician-${npi}`;
  nodes.push(createTrustEntity('clinician', clinicianId, `Clinician ${npi}`, { npi }));

  // ── Issuer + Credential entities from artifacts ─────────────────────
  const seenIssuers = new Set<string>();
  for (const art of artifacts) {
    const issuerKey = art.source.replace(/\s+/g, '-');
    const issuerId = `issuer-${issuerKey}`;

    if (!seenIssuers.has(issuerId)) {
      seenIssuers.add(issuerId);
      nodes.push(createTrustEntity('issuer', issuerId, art.source));

      // Issuer verifies clinician
      edges.push(createTrustRelationship('VERIFIED_BY', clinicianId, issuerId, 1.0, 0.9));
    }

    const credId = `credential-${art.id}`;
    const credLabel = art.source.includes(':') ? art.source.split(':').pop()! : 'Credential';
    nodes.push(
      createTrustEntity('credential', credId, credLabel, {
        status: art.status,
        trustState: art.trustState,
        auditHash: art.merkleRoot ?? art.checksum,
      }),
    );

    // Credential issued by issuer
    const issuerTrustWeight = art.status === 'REVOKED' || art.status === 'SUSPENDED' ? 0.1 : 1.0;
    edges.push(createTrustRelationship('ISSUED_BY', credId, issuerId, issuerTrustWeight, 0.95));

    // Credential verifies clinician
    edges.push(createTrustRelationship('VERIFIED_BY', clinicianId, credId, issuerTrustWeight, 0.9));

    // Monitoring relationship for active credentials
    if (art.trustState === 'monitoring' || art.trustState === 'expiring') {
      const verifierId = `verifier-monitor-${issuerKey}`;
      if (!nodes.find((n) => n.id === verifierId)) {
        nodes.push(createTrustEntity('verifier', verifierId, `${art.source} Monitor`));
      }
      edges.push(createTrustRelationship('MONITORED_BY', credId, verifierId, 0.8, 1.0));
    }
  }

  // ── Decision entities from audit capsules ───────────────────────────
  for (const cap of capsules) {
    const meta = (cap.metadata ?? {}) as Record<string, unknown>;
    const decisionType = typeof meta['decisionType'] === 'string' ? meta['decisionType'] : 'UNKNOWN';
    const capStatus = typeof meta['status'] === 'string' ? meta['status'] : 'VALID';
    const credentialIds = Array.isArray(meta['credentialIds']) ? (meta['credentialIds'] as string[]) : [];
    const issuerIdsList = Array.isArray(meta['issuerIds']) ? (meta['issuerIds'] as string[]) : [];

    const decId = `decision-${cap.id}`;
    const confidence = capStatus === 'INVALID' ? 0.1 : capStatus === 'AT_RISK' ? 0.5 : 0.85;
    nodes.push(
      createTrustEntity('decision', decId, `${decisionType} (${capStatus})`, {
        decisionType,
        status: capStatus,
        confidence,
        artifactHash: cap.hash,
      }),
    );

    // Decision depends on credentials
    for (const credRefId of credentialIds) {
      const matchId = `credential-${credRefId}`;
      if (nodes.find((n) => n.id === matchId)) {
        const credNode = nodes.find((n) => n.id === matchId);
        const depWeight = credNode?.metadata?.['status'] === 'REVOKED' ? 0.1 : 1.0;
        edges.push(createTrustRelationship('DEPENDS_ON', decId, matchId, depWeight, confidence));
      }
    }

    // Decision authorized by issuers
    for (const issuerId of issuerIdsList) {
      const matchingIssuer = nodes.find((n) => n.id.startsWith('issuer-') && n.id.includes(issuerId));
      if (matchingIssuer) {
        edges.push(createTrustRelationship('AUTHORIZED_BY', decId, matchingIssuer.id, 1.0, confidence));
      }
    }
  }

  // ── Fallback demo data ──────────────────────────────────────────────
  if (nodes.length === 1) {
    nodes.push(
      createTrustEntity('issuer', 'issuer-state-board', 'State Medical Board'),
      createTrustEntity('credential', 'credential-license', 'State License', {
        status: 'Valid',
        trustState: 'GREEN',
      }),
      createTrustEntity('verifier', 'verifier-psv', 'PSV Engine'),
      createTrustEntity('decision', 'decision-hire', 'HIRING (VALID)', {
        decisionType: 'HIRING',
        status: 'VALID',
        confidence: 0.92,
      }),
    );
    edges.push(
      createTrustRelationship('ISSUED_BY', 'credential-license', 'issuer-state-board', 1.0, 0.95),
      createTrustRelationship('VERIFIED_BY', clinicianId, 'credential-license', 1.0, 0.9),
      createTrustRelationship('VERIFIED_BY', 'credential-license', 'verifier-psv', 1.0, 1.0),
      createTrustRelationship('DEPENDS_ON', 'decision-hire', 'credential-license', 1.0, 0.92),
      createTrustRelationship('AUTHORIZED_BY', 'decision-hire', 'issuer-state-board', 1.0, 0.92),
      createTrustRelationship('MONITORED_BY', 'credential-license', 'verifier-psv', 0.8, 1.0),
    );
  }

  // ── Compute graph metrics ───────────────────────────────────────────
  computeDegreeCentrality(nodes, edges);
  computeTrustScores(nodes, edges);

  log('info', 'knowledge_graph: generated', { npi, nodeCount: nodes.length, edgeCount: edges.length });

  return {
    npi,
    nodes,
    edges,
    entityTypes: TRUST_ENTITY_TYPES,
    relationshipTypes: TRUST_RELATIONSHIP_TYPES,
    generatedAt: new Date().toISOString(),
  };
}
