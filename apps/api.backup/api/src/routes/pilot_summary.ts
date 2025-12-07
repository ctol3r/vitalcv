/**
 * Pilot Summary PDF Generation Endpoint
 * Triggers the weekly summary PDF generation script
 */

import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const pilotSummary = Router();

pilotSummary.post('/api/pilot/summary/send', async (_req: Request, res: Response) => {
  try {
    // Run the weekly summary script using ts-node (already available)
    const scriptPath = require('path').join(__dirname, '../../scripts/pilot_summary_weekly.ts');
    const { stdout, stderr } = await execAsync(`npx ts-node ${scriptPath}`, {
      env: { ...process.env },
      timeout: 60000, // 60 second timeout
      cwd: require('path').join(__dirname, '../..'),
    });

    if (stderr && !stderr.includes('PILOT_SUMMARY_OK')) {
      console.error('Pilot summary script stderr:', stderr);
    }

    res.json({
      ok: true,
      message: 'Weekly summary PDF generated and sent',
      output: stdout,
    });
  } catch (error: any) {
    console.error('Pilot summary generation error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: error.message || 'Failed to generate pilot summary',
    });
  }
});

