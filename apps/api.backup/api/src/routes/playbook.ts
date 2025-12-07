/**
 * Operational Playbook Endpoints
 * Quick-reference guides and runbook procedures
 */

import { Router } from 'express';
import fs from 'fs';
import path from 'path';

export const playbook = Router();

// Get Asset Hub runbook
playbook.get('/api/playbook/asset-hub', (req, res) => {
  try {
    const runbookPath = path.join(__dirname, '../../docs/asset_hub_runbook.md');

    if (fs.existsSync(runbookPath)) {
      const content = fs.readFileSync(runbookPath, 'utf-8');
      res.json({
        ok: true,
        title: 'Asset Hub Post-Cutover Operations',
        content,
        format: 'markdown',
      });
    } else {
      res.status(404).json({ ok: false, error: 'Runbook not found' });
    }
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get compliance playbook snippets
playbook.get('/api/playbook/compliance/:topic', (req, res) => {
  const { topic } = req.params;

  const playbooks: Record<string, any> = {
    nlc: {
      title: 'NLC 60-Day Residency Rule',
      summary: 'When a nurse changes home state, they must obtain a new multistate license within 60 days.',
      steps: [
        'Record residency move with moveDate',
        'System computes breachDate = moveDate + 60 days',
        'Alerts sent at D-30, D-14, D-7, D-0',
        'Remote-state practice blocked after breach',
        'Satisfied when new license obtained',
      ],
      api: '/api/nlc/residency-move',
      policy: 'NLC residency change effective Jan 2, 2024',
    },
    psypact: {
      title: 'PSYPACT Credential Verification',
      summary: 'Psychology compact requires APIT (tele) or TAP (temp in-person) + E.Passport',
      steps: [
        'Verify E.Passport credential',
        'Check APIT for telepsychology (90-day TTL)',
        'Check TAP for temporary in-person (30-day TTL)',
        'Cache results in database',
        'Refresh when expired',
      ],
      api: '/api/psych/psypact/:npi',
      authorities: ['APIT', 'TAP'],
    },
    pecos: {
      title: 'PECOS Revalidation Cycles',
      summary: '5-year cycle for most physicians, 3-year for DME suppliers',
      steps: [
        'Create revalidation record with cycle type',
        'System sends alerts at D-90, D-60, D-30, D-7',
        'Download ICS calendar for tracking',
        'Mark completed when done',
      ],
      api: '/api/pecos/revalidation',
      cycles: ['5year', '3year'],
    },
    jcaho: {
      title: 'JCAHO Temporary Privileges',
      summary: 'Temporary privileges cannot exceed 120 consecutive days (MS.06.01.13)',
      steps: [
        'Request temp privileges with daysGranted',
        'System validates daysGranted ≤ 120',
        'Extension requests check total ≤ 120',
        'Violations recorded in audit log',
      ],
      api: '/api/privileges/temp',
      standard: 'JCAHO MS.06.01.13',
    },
  };

  const book = playbooks[topic];

  if (!book) {
    return res.status(404).json({
      ok: false,
      error: 'Playbook not found',
      available: Object.keys(playbooks),
    });
  }

  res.json({ ok: true, playbook: book });
});

// List all playbooks
playbook.get('/api/playbook', (req, res) => {
  res.json({
    ok: true,
    playbooks: [
      { id: 'asset-hub', title: 'Asset Hub Operations' },
      { id: 'nlc', title: 'NLC 60-Day Residency Rule' },
      { id: 'psypact', title: 'PSYPACT Verification' },
      { id: 'pecos', title: 'PECOS Revalidation' },
      { id: 'jcaho', title: 'JCAHO Temp Privileges' },
    ],
  });
});
