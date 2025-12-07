import { Router } from 'express';
import { pool } from '../db';
import { adminGuard } from '../middleware/admin_guard';

export const junit = Router();

/**
 * Generate JUnit XML for a demo run
 * Compatible with CI/CD systems like GitHub Actions, Jenkins, etc.
 */
junit.get('/api/dev/demo/junit/:runId', adminGuard, async (req, res) => {
  const id = req.params.runId;

  // Fetch run details
  const runResult = await pool.query(
    'SELECT id, name, status, started_at, finished_at FROM "DemoRun" WHERE id=$1',
    [id]
  );
  const run = runResult.rows[0];

  if (!run) {
    return res.status(404).send('Run not found');
  }

  // Fetch all steps
  const stepsResult = await pool.query(
    'SELECT idx, step, status, duration_ms, error FROM "DemoRunStep" WHERE run_id=$1 ORDER BY idx',
    [id]
  );
  const steps = stepsResult.rows;

  // Calculate test suite stats
  const tests = steps.length;
  const failures = steps.filter((s: any) => s.status !== 'pass').length;
  const name = run.name || `Run ${id}`;

  // Calculate total duration
  const startTime = new Date(run.started_at).getTime();
  const endTime = run.finished_at ? new Date(run.finished_at).getTime() : Date.now();
  const totalTime = ((endTime - startTime) / 1000).toFixed(3);

  // Generate testcase XML for each step
  const testCases = steps.map((s: any) => {
    const stepType = s.step?.type || 'step';
    const stepName = `${stepType}:${s.idx}`;
    const time = ((s.duration_ms || 0) / 1000).toFixed(3);
    const className = `demo.${(run.name || 'script').replace(/\s+/g, '_')}`;

    let failureXml = '';
    if (s.status !== 'pass') {
      const errorMsg = escapeXml(s.error || 'failed');
      failureXml = `
    <failure message="${errorMsg}"></failure>`;
    }

    return `  <testcase classname="${className}" name="${stepName}" time="${time}">${failureXml}
  </testcase>`;
  }).join('\n');

  // Generate complete JUnit XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="${escapeXml(name)}" tests="${tests}" failures="${failures}" time="${totalTime}">
${testCases}
</testsuite>`;

  res.type('application/xml').send(xml);
});

/**
 * Escape special XML characters
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}


