import { PrismaClient } from '@prisma/client';
import { Request, Response, Router } from 'express';
import { EmergencyGovernanceService } from '../services/compliance/emergencyMode';

const router = Router();
const prisma = new PrismaClient();

router.post('/compliance/emergency/declare', async (req: Request, res: Response): Promise<void> => {
  try {
    const { active, context, npi } = req.body;

    if (typeof active !== 'boolean' || !context || !npi) {
       res.status(400).json({ error: 'Missing required parameters: active, context, npi' });
       return;
    }

    // In a real system, we'd verify `npi` belongs to an authorized Hospital Admin or Government Official
    const declaration = EmergencyGovernanceService.declareEmergency(active, context, npi);

    res.json({
      success: true,
      message: `Emergency mode ${active ? 'activated' : 'deactivated'} successfully.`,
      declaration
    });

  } catch (err) {
    console.error('[EMERGENCY_ROUTE] Error declaring emergency:', err);
    res.status(500).json({ error: 'Failed to process emergency declaration' });
  }
});

router.get('/compliance/emergency/status', async (req: Request, res: Response): Promise<void> => {
  res.json({
    active: EmergencyGovernanceService.isEmergencyActive()
  });
});

export const complianceRoutes = router;
