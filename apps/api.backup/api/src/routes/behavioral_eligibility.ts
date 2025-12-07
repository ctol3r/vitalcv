/**
 * Behavioral Health Compact Eligibility - Batch 54
 * PSYPACT (APIT/TAP/E.Passport) + Counseling Compact
 */

import { Router } from 'express';

export const behavioral = Router();

behavioral.get('/api/behavioral/eligibility', (req, res) => {
  const npi = req.query.npi as string | undefined;
  const mode = (req.query.mode || 'tele').toString();

  // PSYPACT: Authority to Practice Interjurisdictional Telepsychology
  const psypact = {
    apit: mode === 'tele', // Telepsychology authority
    tap: mode === 'temp',  // Temporary in-person authority
    epassport: npi ? `PSYPACT-${npi}` : 'DEMO_EPASSPORT',
    home_state: 'CA',
    member_states: 41, // As of 2025
  };

  // Counseling Compact: privilege-to-practice semantics
  const counseling = {
    privilege_required: true,
    eligible: mode === 'tele',
    compact_name: 'Counseling Compact',
    member_states: 34, // Growing adoption
  };

  res.json({
    ok: true,
    npi: npi || null,
    mode,
    psypact,
    counseling,
    note: 'PSYPACT focuses on psychologists; Counseling Compact on LPCs/licensed counselors',
  });
});

