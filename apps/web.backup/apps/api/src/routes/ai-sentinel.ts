import { Router, type Request, type Response } from 'express';
import { getGovernancePolicy, isActionAllowed } from '../services/ai/governance';
import { getAIIncidents, createAIIncident } from '../services/ai/incidents';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/ai-sentinel
 * Get AI sentinel status
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const sentinels = await prisma.aIRiskSentinel.findMany();
    const incidents = await getAIIncidents();

    return res.json({
      sentinels: sentinels.map(s => ({
        agentId: s.agentId,
        config: s.config,
        updatedAt: s.updatedAt,
      })),
      incidents,
    });
  } catch (error) {
    console.error('[ai-sentinel:get] error', error);
    return res.status(500).json({ error: 'sentinel_fetch_failed' });
  }
});

/**
 * GET /api/ai-sentinel/:agentId
 * Get agent governance policy
 */
router.get('/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const policy = await getGovernancePolicy(agentId);
    const incidents = await getAIIncidents(agentId);

    if (!policy) {
      return res.status(404).json({ error: 'agent_not_found' });
    }

    return res.json({
      policy,
      incidents,
    });
  } catch (error) {
    console.error('[ai-sentinel:agent] error', error);
    return res.status(500).json({ error: 'policy_fetch_failed' });
  }
});

/**
 * POST /api/ai-sentinel/incidents
 * Create incident
 */
router.post('/incidents', async (req: Request, res: Response) => {
  try {
    const { agentId, type, severity, description } = req.body;
    const incident = await createAIIncident(agentId, type, severity, description);
    return res.json(incident);
  } catch (error) {
    console.error('[ai-sentinel:incident] error', error);
    return res.status(500).json({ error: 'incident_creation_failed' });
  }
});

export default router;

