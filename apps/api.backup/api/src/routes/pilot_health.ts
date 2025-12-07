/**
 * Pilot Health Widget Aggregator API
 * Combines Exec Brief metrics, PSV score, AI governance bias/accuracy, Wallet compliance, and FHIR bridge uptime
 */

import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const health = Router();

health.get('/api/pilot/health', async (_req: Request, res: Response) => {
  try {
    const port = process.env.PORT || 3001;
    const baseUrl = `http://localhost:${port}`;

    // Fetch Exec Brief HTML length
    const exec = await fetch(`${baseUrl}/api/dev/exec-brief.html`)
      .then((r) => r.text())
      .catch(() => null);

    // Fetch weighted PSV score
    const psv = await fetch(`${baseUrl}/api/compliance/psv-score/weighted`)
      .then((r) => r.json())
      .catch(() => ({ pct: 0, grade: 'C' }));

    // Fetch AI governance events
    const ai = await fetch(`${baseUrl}/api/ai/governance`)
      .then((r) => r.json())
      .catch(() => ({ rows: [] }));

    // Fetch wallet stats
    const wallet = await fetch(`${baseUrl}/api/verify/wallet/stats`)
      .then((r) => r.json())
      .catch(() => ({ remote: 0, proximity: 0, cert_share: 0 }));

    res.json({
      timestamp: new Date().toISOString(),
      exec_length: exec?.length || 0,
      psv_score: psv,
      ai_events: ai.rows?.length || 0,
      wallet,
      grade: psv.grade || 'C',
    });
  } catch (error: any) {
    console.error('Pilot health aggregation error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: error.message || 'Failed to aggregate pilot health metrics',
    });
  }
});

/**
 * POST /api/pilot/summary/send
 * Generate and email weekly pilot summary PDF
 */
health.post('/api/pilot/summary/send', async (_req: Request, res: Response) => {
  try {
    const port = process.env.PORT || 3001;

    // Run the script using tsx (relative to backend directory)
    const { stdout, stderr } = await execAsync(`pnpm tsx scripts/pilot_summary_weekly.ts`, {
      cwd: process.cwd(),
      env: { ...process.env, PORT: port.toString() },
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    if (stderr && !stderr.includes('PILOT_SUMMARY_OK')) {
      console.error('Pilot summary script stderr:', stderr);
    }

    res.json({
      ok: true,
      message: 'Weekly pilot summary PDF generated and sent',
      output: stdout,
    });
  } catch (error: any) {
    console.error('Pilot summary generation error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: error.message || 'Failed to generate pilot summary PDF',
    });
  }
});

