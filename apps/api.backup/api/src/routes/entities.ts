import { PrismaClient } from '@prisma/client';
import { Request, Response, Router } from 'express';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// Validation schemas
const createEntitySchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  text: z.string().default(''),
  tags: z.array(z.string()).default([]),
});

const updateEntitySchema = createEntitySchema.partial();

// GET /api/entities - List all entities
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type, name } = req.query;

    const where: any = {};
    if (type) where.type = type;
    if (name) where.name = { contains: name as string, mode: 'insensitive' };

    const entities = await prisma.entity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ entities });
  } catch (error: any) {
    console.error('Error getting entities:', error);
    return res.status(500).json({ error: 'Failed to get entities', details: error.message });
  }
});

// GET /api/entities/:id - Get single entity
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const entity = await prisma.entity.findUnique({
      where: { id },
    });

    if (!entity) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    return res.json({ entity });
  } catch (error: any) {
    console.error('Error getting entity:', error);
    return res.status(500).json({ error: 'Failed to get entity', details: error.message });
  }
});

// POST /api/entities - Create entity
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createEntitySchema.parse(req.body);

    const entity = await prisma.entity.create({
      data,
    });

    return res.status(201).json({ entity });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error creating entity:', error);
    return res.status(500).json({ error: 'Failed to create entity', details: error.message });
  }
});

// PATCH /api/entities/:id - Update entity
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateEntitySchema.parse(req.body);

    const entity = await prisma.entity.update({
      where: { id },
      data,
    });

    return res.json({ entity });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error updating entity:', error);
    return res.status(500).json({ error: 'Failed to update entity', details: error.message });
  }
});

// DELETE /api/entities/:id - Delete entity
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Also delete associated links
    await prisma.link.deleteMany({
      where: {
        OR: [{ sourceId: id }, { targetId: id }],
      },
    });

    await prisma.entity.delete({
      where: { id },
    });

    return res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting entity:', error);
    return res.status(500).json({ error: 'Failed to delete entity', details: error.message });
  }
});

export default router;
