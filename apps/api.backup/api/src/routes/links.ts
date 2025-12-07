import { PrismaClient } from '@prisma/client';
import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { buildIndex, getLinks, getRecentLinks, inferLinks } from '../services/linkEngine.js';

const router = Router();
const prisma = new PrismaClient();

// GET /api/links - Get links for a specific entity
router.get('/', async (req: Request, res: Response) => {
  try {
    const entityId = req.query.entityId as string;

    if (!entityId) {
      return res.status(400).json({ error: 'Missing entityId parameter' });
    }

    const links = await getLinks(entityId);
    return res.json({ links });
  } catch (error: any) {
    console.error('Error getting links:', error);
    return res.status(500).json({ error: 'Failed to get links', details: error.message });
  }
});

// POST /api/links/infer - Infer links from text
router.post('/infer', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      entityId: z.string(),
      text: z.string().min(5),
    });

    const { entityId, text } = schema.parse(req.body);

    const links = await inferLinks(entityId, text);
    return res.json({ success: true, links });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error inferring links:', error);
    return res.status(500).json({ error: 'Failed to infer links', details: error.message });
  }
});

// GET /api/links/recent - Get recent links
router.get('/recent', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const links = await getRecentLinks(limit);
    return res.json({ links });
  } catch (error: any) {
    console.error('Error getting recent links:', error);
    return res.status(500).json({ error: 'Failed to get recent links', details: error.message });
  }
});

// POST /api/links/rebuild - Rebuild search index (admin only)
router.post('/rebuild', async (req: Request, res: Response) => {
  try {
    const success = await buildIndex();

    if (!success) {
      return res.status(500).json({ error: 'Failed to rebuild index' });
    }

    return res.json({ success: true, message: 'Search index rebuilt successfully' });
  } catch (error: any) {
    console.error('Error rebuilding index:', error);
    return res.status(500).json({ error: 'Failed to rebuild index', details: error.message });
  }
});

export default router;
