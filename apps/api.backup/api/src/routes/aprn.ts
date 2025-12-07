import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export const aprnRouter = Router();

// Get APRN compact status for a state
aprnRouter.get('/api/aprn/compact/:state', async (req, res) => {
  try {
    const { state } = req.params;
    const compact = await prisma.compactMatrix.findFirst({
      where: {
        compact: 'aprn',
        state: state.toUpperCase(),
      },
    });

    if (!compact) {
      return res.json({
        state,
        status: 'not_member',
        message: 'State is not part of APRN Compact',
      });
    }

    res.json({
      state,
      status: compact.status,
      specialRules: compact.specialRules,
    });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Get all APRN compact states
aprnRouter.get('/api/aprn/compact', async (req, res) => {
  try {
    const states = await prisma.compactMatrix.findMany({
      where: {
        compact: 'aprn',
        status: 'active',
      },
    });

    res.json({
      ok: true,
      compact: 'aprn',
      states: states.map((s) => s.state),
      count: states.length,
    });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

