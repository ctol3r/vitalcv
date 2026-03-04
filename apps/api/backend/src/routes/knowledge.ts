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
  app.get('/api/knowledge/:npi', publicApiRateLimit, async (req: Request, res: Response) => {
    const npi = typeof req.params.npi === 'string' ? req.params.npi.trim() : '';
    if (!/^\d{10}$/.test(npi)) {
      return res.status(400).json({ error: 'Invalid NPI format — expected 10 digits' });
    }

    const organizationId = getRequestOrganizationId(req)?.trim();
    if (!organizationId) {
      return res.status(401).json({
        error: 'organization_context_required',
        error_description: 'Organization context is required.',
      });
    }

    try {
      const result = await generateKnowledgeGraph(npi, { organizationId });

      log('info', 'knowledge_graph_generated', {
        event: 'knowledge_graph_generated',
        npi_masked: maskNpi(npi),
        npi_sha256: sha256Hex(npi),
        organizationId,
        nodeCount: result.graph.nodes.length,
        edgeCount: result.graph.edges.length,
      });

      return res.status(200).json({
        npi,
        ...result,
      });
    } catch (error) {
      log('error', 'knowledge_graph_generation_failed', {
        event: 'knowledge_graph_generation_failed',
        npi_masked: maskNpi(npi),
        npi_sha256: sha256Hex(npi),
        organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return res.status(500).json({ error: 'Failed to generate knowledge graph' });
    }
  });
}
