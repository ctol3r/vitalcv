/**
 * knowledge.ts — Wave 92: Trust Knowledge Protocol API
 *
 * GET /api/knowledge/:npi — Returns full knowledge graph context for a clinician.
 */

import type { Express, Request, Response } from 'express';
import { generateTrustKnowledgeGraph } from '../services/knowledge/knowledgeGraph';
import { RELATIONSHIP_SEMANTICS } from '../services/knowledge/trustRelationships';
import { log } from '../obs/logger';

export function registerKnowledgeRoutes(app: Express): void {
  app.get('/api/knowledge/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!npi) {
      res.status(400).json({ error: 'NPI parameter is required' });
      return;
    }

    try {
      const graph = await generateTrustKnowledgeGraph(npi);

      res.json({
        ...graph,
        relationshipSemantics: RELATIONSHIP_SEMANTICS,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'knowledge_route: failed', { npi, error: message });
      res.status(500).json({ error: 'Failed to generate knowledge graph' });
    }
  });
}
