import { PrismaClient } from '@prisma/client';
import { Request, Response, Router } from 'express';
import NodeCache from 'node-cache';

const router = Router();
const prisma = new PrismaClient();

// Cache graph data for 15 seconds
const cache = new NodeCache({ stdTTL: 15 });

interface GraphNode {
  id: string;
  group: string;
  label: string;
}

interface GraphLink {
  source: string;
  target: string;
  weight: number;
}

// GET /api/graph - Get network graph data
router.get('/', async (req: Request, res: Response) => {
  try {
    // Check cache first
    const cached = cache.get('graph');
    if (cached) {
      return res.json(cached);
    }

    // Fetch all entities (limit 500 to avoid bloat)
    const entities = await prisma.entity.findMany({
      take: 500,
      select: {
        id: true,
        name: true,
        type: true,
      },
    });

    // Fetch all links for these entities
    const entityIds = entities.map((e) => e.id);
    const links = await prisma.link.findMany({
      where: {
        OR: [{ sourceId: { in: entityIds } }, { targetId: { in: entityIds } }],
      },
      select: {
        sourceId: true,
        targetId: true,
        score: true,
      },
    });

    // Map entities to nodes
    const nodes: GraphNode[] = entities.map((entity) => ({
      id: entity.id,
      group: entity.type,
      label: entity.name,
    }));

    // Map links to edges
    const edges: GraphLink[] = links.map((link) => ({
      source: link.sourceId,
      target: link.targetId,
      weight: Math.round(link.score * 2), // Scale score (0.8 -> 1.6 -> 2)
    }));

    // Create graph response
    const graph = { nodes, links: edges };

    // Cache it
    cache.set('graph', graph);

    return res.json(graph);
  } catch (error: any) {
    console.error('Error getting graph:', error);
    return res.status(500).json({ error: 'Failed to get graph', details: error.message });
  }
});

export default router;
