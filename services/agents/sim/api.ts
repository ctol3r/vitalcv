import express, { Request, Response } from 'express';
import { getSimSuite } from './adversarial';

const router = express.Router();
const simSuite = getSimSuite();

/**
 * POST /sim/run
 * Run all adversarial simulations
 */
router.post('/sim/run', async (req: Request, res: Response) => {
  try {
    const results = await simSuite.runAll();
    const report = simSuite.generateReport(results);
    const hitlCheck = simSuite.checkHITLGates(results);

    res.json({
      results,
      report,
      hitlCheck,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Simulation failed',
      message: error instanceof Error ? error.message : 'unknown error',
    });
  }
});

/**
 * GET /sim/reports
 * Get simulation reports
 */
router.get('/sim/reports', async (req: Request, res: Response) => {
  try {
    const results = await simSuite.runAll();
    const report = simSuite.generateReport(results);

    res.json({
      report,
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Report generation failed',
      message: error instanceof Error ? error.message : 'unknown error',
    });
  }
});

export default router;

