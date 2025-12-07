/**
 * NCQA 2025 PSV Verification Events - Batch 54
 * Tracks all primary-source verifications with method & evidence
 */

import { Router } from 'express';

export const verifyEvents = Router();

export type VerificationEvent = {
  id: string;
  subject_npi: string;
  source_name: string;
  source_url?: string;
  method: 'API' | 'Manual';
  pulled_at: string;
  reviewed_by?: string;
  result: string;
  evidence_hash?: string;
  anchor_tx?: string;
};

// In-memory store (replace with DB)
const EVENTS: VerificationEvent[] = [];

verifyEvents.get('/api/verify/events', (req, res) => {
  const npi = req.query.subject_npi as string | undefined;

  const filtered = npi
    ? EVENTS.filter((e) => e.subject_npi === npi)
    : EVENTS;

  res.json({ ok: true, rows: filtered, count: filtered.length });
});

// POST to create new verification event
verifyEvents.post('/api/verify/events', (req, res) => {
  const event: VerificationEvent = {
    id: `evt_${Date.now()}`,
    ...req.body,
    pulled_at: req.body.pulled_at || new Date().toISOString(),
  };

  EVENTS.push(event);
  res.json({ ok: true, event });
});

