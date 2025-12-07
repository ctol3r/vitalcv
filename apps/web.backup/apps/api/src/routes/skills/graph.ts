import { Router, type Request, type Response } from 'express';

import { buildSkillGraph } from '../../services/skills/graph';

const router = Router();

router.get('/:clinicianId', async (req: Request, res: Response) => {
  const { clinicianId } = req.params;
  if (!clinicianId) {
    return res.status(400).json({
      error: 'clinician_id_required',
      message: 'Provide clinicianId to build a skill graph.',
    });
  }

  const months = Number(req.query.months ?? '12');

  try {
    const graph = await buildSkillGraph(clinicianId, {
      monthsOfVolume: Number.isFinite(months) ? months : 12,
    });
    if (!graph) {
      return res.status(404).json({
        error: 'clinician_not_found',
        message: `Clinician ${clinicianId} not found`,
      });
    }
    return res.json({ graph });
  } catch (error) {
    console.error('[skills:graph] failed', error);
    return res.status(500).json({
      error: 'skill_graph_failed',
      message: error instanceof Error ? error.message : 'Unable to build skill graph',
    });
  }
});

export default router;

