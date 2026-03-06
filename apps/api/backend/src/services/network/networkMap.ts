/**
 * networkMap.ts — Wave 89: Global Network Map Generator
 *
 * Aggregated graph data for the entire trust network.
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────

export interface NetworkMapNode {
  id: string;
  label: string;
  group: 'clinician' | 'issuer' | 'employer';
  val: number;
  connectionCount: number;
}

export interface NetworkMapEdge {
  source: string;
  target: string;
  label: string;
}

export interface NetworkMapData {
  nodes: NetworkMapNode[];
  edges: NetworkMapEdge[];
  generatedAt: string;
}

// ── Generator ─────────────────────────────────────────────────────────

export async function generateNetworkMap(): Promise<NetworkMapData> {
  const [providers, artifacts, acceptances] = await Promise.all([
    prisma.provider.findMany({ take: 50, orderBy: { createdAt: 'desc' }, select: { npi: true, fullName: true } }),
    prisma.verificationArtifact.findMany({ take: 200, orderBy: { createdAt: 'desc' }, select: { npi: true, source: true } }),
    prisma.acceptance.findMany({ take: 100, orderBy: { createdAt: 'desc' }, select: { subjectId: true, employerId: true } }),
  ]);

  const nodes: NetworkMapNode[] = [];
  const edges: NetworkMapEdge[] = [];
  const nodeIds = new Set<string>();
  const connectionCounts = new Map<string, number>();

  // Clinician nodes
  for (const p of providers) {
    const id = `clinician-${p.npi}`;
    if (!nodeIds.has(id)) {
      nodeIds.add(id);
      nodes.push({ id, label: p.fullName ?? p.npi, group: 'clinician', val: 18, connectionCount: 0 });
    }
  }

  // Issuer nodes from artifacts
  const issuerMap = new Map<string, string>();
  for (const a of artifacts) {
    const issuerId = `issuer-${a.source.replace(/\s+/g, '-')}`;
    if (!nodeIds.has(issuerId)) {
      nodeIds.add(issuerId);
      issuerMap.set(a.source, issuerId);
      nodes.push({ id: issuerId, label: a.source, group: 'issuer', val: 14, connectionCount: 0 });
    }
    const clinicianId = `clinician-${a.npi}`;
    if (nodeIds.has(clinicianId)) {
      edges.push({ source: issuerId, target: clinicianId, label: 'VERIFIED' });
      connectionCounts.set(issuerId, (connectionCounts.get(issuerId) ?? 0) + 1);
      connectionCounts.set(clinicianId, (connectionCounts.get(clinicianId) ?? 0) + 1);
    }
  }

  // Employer nodes from acceptances
  for (const acc of acceptances) {
    const empId = `employer-${acc.employerId}`;
    if (!nodeIds.has(empId)) {
      nodeIds.add(empId);
      nodes.push({ id: empId, label: acc.employerId, group: 'employer', val: 16, connectionCount: 0 });
    }
    const clinicianId = `clinician-${acc.subjectId}`;
    if (nodeIds.has(clinicianId)) {
      edges.push({ source: clinicianId, target: empId, label: 'EMPLOYED_AT' });
      connectionCounts.set(empId, (connectionCounts.get(empId) ?? 0) + 1);
      connectionCounts.set(clinicianId, (connectionCounts.get(clinicianId) ?? 0) + 1);
    }
  }

  // Update connection counts
  for (const node of nodes) {
    node.connectionCount = connectionCounts.get(node.id) ?? 0;
  }

  log('info', 'network_map: generated', { nodes: nodes.length, edges: edges.length });

  return { nodes, edges, generatedAt: new Date().toISOString() };
}
