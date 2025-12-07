import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { aggregateLifecycleEvents } from '../../services/lifecycle/aggregate';

const router = Router();
const prisma = new PrismaClient();

router.get('/:credentialId', async (req, res) => {
  const { credentialId } = req.params;

  try {
    const credential = await prisma.credential.findUnique({
      where: { id: credentialId },
    });

    if (!credential) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    const timeline = await aggregateLifecycleEvents(credentialId);
    const chainAnchors = timeline.filter((e) => e.type === 'ANCHORING');

    res.json({
      credential,
      timeline,
      chainAnchors,
    });
  } catch (error) {
    console.error('Error fetching lifecycle:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const lifecycleRouter = router;
export default router;














