import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/compliance/ncqa/records
 * Fetch NCQA compliance records
 */
router.get('/records', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    // @ts-ignore - model added recently
    const records = await prisma.nCQARecord.findMany({
      take: Number(limit),
      skip: Number(offset),
      orderBy: { checkedAt: 'desc' },
    });

    // Fetch credentials to display names
    // @ts-ignore
    const credentialIds = [...new Set(records.map((r) => r.credentialId))];
    const credentials = await prisma.credential.findMany({
      where: { id: { in: credentialIds } },
      select: { id: true, name: true, type: true, userId: true, user: { select: { name: true } } },
    });

    const credMap = new Map(credentials.map((c) => [c.id, c]));

    // @ts-ignore
    const enriched = records.map((r) => {
      const cred = credMap.get(r.credentialId);
      return {
        ...r,
        credentialName: cred?.name,
        credentialType: cred?.type,
        userName: cred?.user?.name,
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error('Error fetching NCQA records:', error);
    res.status(500).json({ error: 'Failed to fetch NCQA records' });
  }
});

export { router as complianceNcqaRouter };














