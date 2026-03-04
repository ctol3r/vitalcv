/**
 * trustGraphExplorer.ts — Wave 53: Trust Graph Explorer API
 *
 * Enhanced graph endpoint that combines the trust graph visualization data
 * with MATCHA CRS results and audit events for a complete explorer view.
 *
 * GET /api/graph/explorer/:npi
 */

import type { Express, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import { generateTrustGraph } from '../services/graph/trustGraph';

// ── Types ─────────────────────────────────────────────────────────────────

interface ExplorerNode {
  id: string;
  label: string;
  group: 'clinician' | 'issuer' | 'employer' | 'credential' | 'policy';
  status?: string;
  trustState?: string;
  auditHash?: string | null;
  val: number;
  metadata?: Record<string, unknown>;
}

interface ExplorerEdge {
  source: string;
  target: string;
  label: string;
  weight?: number;
}

interface CrsSummary {
  policyId: string;
  facilityName: string;
  roleName: string;
  crsScore: number;
  crsBand: string;
  isCleared: boolean;
  matchedCount: number;
  missingCount: number;
  evaluatedAt: string;
}

interface AuditEntry {
  id: string;
  type: string;
  hash: string;
  createdAt: string;
  metadata: unknown;
}

interface ExplorerResponse {
  npi: string;
  graph: {
    nodes: ExplorerNode[];
    edges: ExplorerEdge[];
  };
  crs: {
    overallBand: string;
    overallScore: number;
    evaluations: CrsSummary[];
  };
  audit: {
    events: AuditEntry[];
    totalCount: number;
  };
  credentials: Array<{
    id: string;
    source: string;
    status: string;
    lifecycleState: string;
    verifiedAt: string;
    expiresAt: string | null;
  }>;
  generatedAt: string;
}

// ── Route ─────────────────────────────────────────────────────────────────

export function registerTrustGraphExplorerRoutes(app: Express): void {
  app.get('/api/graph/explorer/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;

    if (!npi || !/^\d{10}$/.test(npi)) {
      return res.status(400).json({ error: 'Invalid NPI format — expected 10 digits' });
    }

    try {
      // ── Parallel data fetching ──────────────────────────────────────
      const [baseGraph, matchResults, auditEvents, artifacts] = await Promise.all([
        generateTrustGraph(npi),
        prisma.matchResult.findMany({
          where: { clinicianNpi: npi },
          orderBy: { evaluatedAt: 'desc' },
          take: 20,
          include: { policy: true },
        }),
        prisma.auditEvent.findMany({
          where: { clinicianId: npi },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        prisma.verificationArtifact.findMany({
          where: { npi },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      // ── Enrich graph with policy nodes from MATCHA results ──────────
      const nodes: ExplorerNode[] = baseGraph.nodes.map((n) => ({
        ...n,
        metadata: {},
      }));
      const edges: ExplorerEdge[] = baseGraph.edges.map((e) => ({
        ...e,
        weight: 1,
      }));

      const seenPolicies = new Set<string>();
      for (const mr of matchResults) {
        const policyNodeId = `policy-${mr.policyId}`;
        if (!seenPolicies.has(policyNodeId)) {
          seenPolicies.add(policyNodeId);
          nodes.push({
            id: policyNodeId,
            label: `${mr.policy.roleName} @ ${mr.policy.facilityName}`,
            group: 'policy',
            status: mr.crsBand,
            val: 12,
            metadata: {
              crsScore: mr.crsScore,
              crsBand: mr.crsBand,
              isCleared: mr.isCleared,
            },
          });

          // Connect policy to employer if possible
          const employerNode = nodes.find(
            (n) => n.group === 'employer' && n.label === mr.policy.employerId,
          );
          if (employerNode) {
            edges.push({
              source: employerNode.id,
              target: policyNodeId,
              label: 'REQUIRES',
              weight: 0.8,
            });
          }

          // Connect clinician to policy via evaluation
          const clinicianNode = nodes.find((n) => n.group === 'clinician');
          if (clinicianNode) {
            edges.push({
              source: clinicianNode.id,
              target: policyNodeId,
              label: mr.isCleared ? 'CLEARED' : 'EVALUATED',
              weight: mr.crsScore / 100,
            });
          }
        }
      }

      // ── CRS summary ─────────────────────────────────────────────────
      const crsSummaries: CrsSummary[] = matchResults.map((mr) => ({
        policyId: mr.policyId,
        facilityName: mr.policy.facilityName,
        roleName: mr.policy.roleName,
        crsScore: mr.crsScore,
        crsBand: mr.crsBand,
        isCleared: mr.isCleared,
        matchedCount: Array.isArray(mr.matchedCreds) ? (mr.matchedCreds as unknown[]).length : 0,
        missingCount: Array.isArray(mr.missingCreds) ? (mr.missingCreds as unknown[]).length : 0,
        evaluatedAt: mr.evaluatedAt.toISOString(),
      }));

      let overallScore = 100;
      let overallBand = 'GREEN';
      if (crsSummaries.length > 0) {
        overallScore = Math.min(...crsSummaries.map((c) => c.crsScore));
        overallBand = overallScore >= 80 ? 'GREEN' : overallScore >= 50 ? 'YELLOW' : 'RED';
      }

      // ── Audit events ────────────────────────────────────────────────
      const auditEntries: AuditEntry[] = auditEvents.map((ae) => ({
        id: ae.id,
        type: ae.type,
        hash: ae.hash,
        createdAt: ae.createdAt.toISOString(),
        metadata: ae.metadata,
      }));

      // ── Credentials list ────────────────────────────────────────────
      const credentials = artifacts.map((a) => ({
        id: a.id,
        source: a.source,
        status: a.status,
        lifecycleState: a.lifecycleState,
        verifiedAt: a.verifiedAt.toISOString(),
        expiresAt: a.expiresAt?.toISOString() ?? null,
      }));

      const response: ExplorerResponse = {
        npi,
        graph: { nodes, edges },
        crs: { overallBand, overallScore, evaluations: crsSummaries },
        audit: { events: auditEntries, totalCount: auditEvents.length },
        credentials,
        generatedAt: new Date().toISOString(),
      };

      log('info', 'trust_graph_explorer: generated', {
        npi: npi.slice(0, 4) + '****',
        nodeCount: nodes.length,
        edgeCount: edges.length,
        crsEvaluations: crsSummaries.length,
        auditEvents: auditEntries.length,
      });

      return res.json(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'trust_graph_explorer: failed', { error: message });
      return res.status(500).json({ error: 'Failed to generate graph explorer data' });
    }
  });
}
