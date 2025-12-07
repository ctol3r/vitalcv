import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  calculateFrictionMatrix,
  detectHiringFriction,
  calculatePrivilegeFriction,
  detectComplianceResonance,
  calculateSafetyPrivilegeReactor,
} from '../../services/employer/friction';

const prisma = new PrismaClient();
const router = Router();

/**
 * Task 518.25 — Implement /api/employer/friction
 * Main endpoint for employer friction physics
 */
router.get('/employer/friction', async (req: Request, res: Response) => {
  try {
    const orgId = req.query.orgId as string | undefined;

    const matrix = await calculateFrictionMatrix({ prisma, orgId });

    return res.json({
      matrix,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[employer][friction] get failed', error);
    return res.status(500).json({
      error: 'friction_matrix_get_failed',
      message: extractMessage(error),
    });
  }
});

router.post('/employer/friction/hiring', async (req: Request, res: Response) => {
  try {
    const { orgId, atsId, outcomeMismatch } = req.body;

    if (!orgId || typeof outcomeMismatch !== 'number') {
      return res.status(400).json({
        error: 'orgId and outcomeMismatch required',
      });
    }

    const result = await detectHiringFriction({
      prisma,
      orgId,
      atsId,
      outcomeMismatch,
    });

    return res.json(result);
  } catch (error) {
    console.error('[employer][friction][hiring] post failed', error);
    return res.status(500).json({
      error: 'hiring_friction_detection_failed',
      message: extractMessage(error),
    });
  }
});

router.get('/employer/friction/privilege', async (req: Request, res: Response) => {
  try {
    const orgId = req.query.orgId as string;
    const privilegeCode = req.query.privilegeCode as string;

    if (!orgId || !privilegeCode) {
      return res.status(400).json({
        error: 'orgId and privilegeCode required',
      });
    }

    const result = await calculatePrivilegeFriction({
      prisma,
      orgId,
      privilegeCode,
    });

    return res.json(result);
  } catch (error) {
    console.error('[employer][friction][privilege] get failed', error);
    return res.status(500).json({
      error: 'privilege_friction_get_failed',
      message: extractMessage(error),
    });
  }
});

router.get('/employer/friction/compliance-resonance', async (req: Request, res: Response) => {
  try {
    const orgId = req.query.orgId as string | undefined;
    const region = req.query.region as string | undefined;

    const result = await detectComplianceResonance({ prisma, orgId, region });

    return res.json(result);
  } catch (error) {
    console.error('[employer][friction][compliance-resonance] get failed', error);
    return res.status(500).json({
      error: 'compliance_resonance_get_failed',
      message: extractMessage(error),
    });
  }
});

router.get('/employer/friction/safety-privilege', async (req: Request, res: Response) => {
  try {
    const orgId = req.query.orgId as string | undefined;
    const clinicianId = req.query.clinicianId as string | undefined;

    const result = await calculateSafetyPrivilegeReactor({
      prisma,
      orgId,
      clinicianId,
    });

    return res.json(result);
  } catch (error) {
    console.error('[employer][friction][safety-privilege] get failed', error);
    return res.status(500).json({
      error: 'safety_privilege_reactor_get_failed',
      message: extractMessage(error),
    });
  }
});

function extractMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export default router;

