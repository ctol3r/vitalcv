import { Router } from 'express';

export const demoOverlay = Router();

/**
 * 5-Minute Demo Script Overlay (Round 15)
 *
 * Provides a structured demo script with timed steps for stakeholder presentations.
 * This helps guide demos through key VitalCV capabilities in a consistent,
 * professional manner.
 */

const DEMO_SCRIPT = [
  {
    t: 0,
    title: 'Welcome',
    note: 'Issuer + Wallet + Verifier overview - Three solutions, one platform'
  },
  {
    t: 30,
    title: 'Offer → Token',
    note: 'Pre-authorized code grant using OpenID4VCI'
  },
  {
    t: 90,
    title: 'Credential Issuance',
    note: 'Issue EdDSA-signed verifiable credential'
  },
  {
    t: 150,
    title: 'Selective Disclosure',
    note: 'Present name only - privacy-preserving credential sharing'
  },
  {
    t: 210,
    title: 'StatusList Flip',
    note: 'Revoke credential → Verifier sees revoked status in real-time'
  },
  {
    t: 270,
    title: 'Anchors & Audit Trail',
    note: 'Show recent blockchain anchors and complete audit trail'
  }
];

/**
 * GET /script
 * Returns the complete demo script with timing and steps
 */
demoOverlay.get('/script', (_req, res) => {
  res.json({
    duration: 300, // 5 minutes
    steps: DEMO_SCRIPT,
    description: 'VitalCV 5-Minute Stakeholder Demo Script'
  });
});

/**
 * POST /run-step
 * Optional hook for tracking demo progress
 * (Currently a no-op placeholder for future analytics)
 */
demoOverlay.post('/run-step', (req, res) => {
  const step = req.body?.step;

  // Future: Could log to analytics, trigger UI hints, etc.
  res.json({
    ok: true,
    step,
    timestamp: new Date().toISOString()
  });
});

