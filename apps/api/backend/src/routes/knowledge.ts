import type { Express, Request, Response } from 'express';
import { getRequestOrganizationId } from '../middleware/organizationContext';
import { publicApiRateLimit } from '../middleware/publicSafety';
import { log } from '../obs/logger';
import { generateKnowledgeGraph } from '../services/graph/knowledgeGraph';
import { sha256Hex } from '../utils/deterministic';

function maskNpi(npi: string): string {
  return `${npi.slice(0, 4)}****`;
}

export function registerKnowledgeRoutes(app: Express): void {
  app.get('/api/knowledge/:nodeId', publicApiRateLimit, async (req: Request, res: Response) => {
    const nodeId = typeof req.params.nodeId === 'string' ? req.params.nodeId.trim() : '';
    if (!nodeId) {
      return res.status(400).json({ error: 'Invalid node ID' });
    }

    const organizationId = getRequestOrganizationId(req)?.trim();
    if (!organizationId) {
      return res.status(401).json({
        error: 'organization_context_required',
        error_description: 'Organization context is required.',
      });
    }

    try {
      // If it's a 10-digit NPI, use the real graph generation
      if (/^\d{10}$/.test(nodeId)) {
        const result = await generateKnowledgeGraph(nodeId, { organizationId });

        log('info', 'knowledge_graph_generated', {
          event: 'knowledge_graph_generated',
          nodeId_masked: maskNpi(nodeId),
          nodeId_sha256: sha256Hex(nodeId),
          organizationId,
          nodeCount: result.graph.nodes.length,
          edgeCount: result.graph.edges.length,
        });

        return res.status(200).json({
          npi: nodeId,
          ...result,
        });
      }

      // For edge streaming simulation from a specific node (e.g. issuer-X, employer-Y)
      // Return a simulated cluster of connected edges
      const mockNodes = [
        { id: `${nodeId}-child-1`, label: 'Affiliated Hub', group: 'decision' },
        { id: `${nodeId}-child-2`, label: 'Network Proxy', group: 'employer' },
        { id: `${nodeId}-child-3`, label: 'Verification Node', group: 'credential' }
      ];

      const mockEdges = [
        { source: nodeId, target: `${nodeId}-child-1`, label: 'EVALUATED_FOR' },
        { source: nodeId, target: `${nodeId}-child-2`, label: 'HAS_TRUST_STATE' },
        { source: nodeId, target: `${nodeId}-child-3`, label: 'ISSUED_BY' }
      ];

      return res.status(200).json({
        nodeId,
        graph: {
          nodes: mockNodes,
          edges: mockEdges
        },
        provenance: {
          trust_state: { count: 1, values: ['trusted'] },
          decision_capsules: { count: 1 },
          verification_artifacts: { count: 1 }
        },
        generatedAt: new Date().toISOString()
      });

    } catch (error) {
      log('error', 'knowledge_graph_generation_failed', {
        event: 'knowledge_graph_generation_failed',
        nodeId,
        organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return res.status(500).json({ error: 'Failed to generate knowledge graph' });
    }
  });
}
