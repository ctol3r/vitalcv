/**
 * decisionCapsules.ts — Wave 54: Decision Capsule API
 *
 * Endpoints for querying decision capsules and analyzing blast radius
 * of credential revocations.
 *
 * GET  /api/decisions/:npi              — list capsules for a clinician
 * GET  /api/decisions/blast-radius/:credentialId — revocation impact analysis
 * POST /api/decisions                   — create a new decision capsule
 */

import type { Express, Request, Response } from 'express';
import { log } from '../obs/logger';
import { capsuleEngine } from '../services/decision/capsuleEngine';
import { revocationCascade } from '../services/decision/revocationCascade';
import type { DecisionType } from '../services/decision/capsuleEngine';

// ── Validation ────────────────────────────────────────────────────────────

const VALID_DECISION_TYPES = ['HIRING', 'PRIVILEGING', 'DEPLOYMENT', 'RENEWAL'];

function isValidDecisionType(value: unknown): value is DecisionType {
  return typeof value === 'string' && VALID_DECISION_TYPES.includes(value);
}

// ── Routes ────────────────────────────────────────────────────────────────

export function registerDecisionCapsuleRoutes(app: Express): void {
  /**
   * GET /api/decisions/:npi
   *
   * List all decision capsules for a clinician, ordered by decision time.
   */
  app.get('/api/decisions/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;

    if (!npi || !/^\d{10}$/.test(npi)) {
      return res.status(400).json({ error: 'Invalid NPI format — expected 10 digits' });
    }

    try {
      const capsules = await capsuleEngine.getCapsulesByNpi(npi);

      const statusCounts = {
        VALID: 0,
        AT_RISK: 0,
        INVALID: 0,
      };
      for (const c of capsules) {
        if (c.status in statusCounts) {
          statusCounts[c.status as keyof typeof statusCounts]++;
        }
      }

      return res.json({
        npi,
        capsules,
        totalCount: capsules.length,
        statusCounts,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'decision_capsules: list failed', { error: message });
      return res.status(500).json({ error: 'Failed to retrieve decision capsules' });
    }
  });

  /**
   * GET /api/decisions/blast-radius/:credentialId
   *
   * Compute the blast radius of revoking a specific credential.
   * Read-only — does not actually perform revocation.
   */
  app.get(
    '/api/decisions/blast-radius/:credentialId',
    async (req: Request, res: Response) => {
      const { credentialId } = req.params;

      if (!credentialId) {
        return res.status(400).json({ error: 'credentialId is required' });
      }

      try {
        const blastRadius = await revocationCascade.computeBlastRadius(credentialId);

        log('info', 'decision_capsules: blast radius computed', {
          credentialId: credentialId.slice(0, 8) + '...',
          totalImpacted: blastRadius.totalImpacted,
        });

        return res.json(blastRadius);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        log('error', 'decision_capsules: blast radius failed', { error: message });
        return res.status(500).json({ error: 'Failed to compute blast radius' });
      }
    },
  );

  /**
   * POST /api/decisions
   *
   * Create a new decision capsule recording an operational decision.
   */
  app.post('/api/decisions', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const subjectDid = typeof body.subjectDid === 'string' ? body.subjectDid.trim() : '';
    const subjectNpi = typeof body.subjectNpi === 'string' ? body.subjectNpi.trim() : '';
    const decisionType = body.decisionType;
    const credentialIds = Array.isArray(body.credentialIds) ? body.credentialIds.filter((id): id is string => typeof id === 'string') : [];
    const issuerIds = Array.isArray(body.issuerIds) ? body.issuerIds.filter((id): id is string => typeof id === 'string') : [];
    const metadata = typeof body.metadata === 'object' && body.metadata !== null
      ? body.metadata as Record<string, unknown>
      : undefined;

    if (!subjectNpi || !/^\d{10}$/.test(subjectNpi)) {
      return res.status(400).json({ error: 'Invalid subjectNpi — expected 10 digits' });
    }

    if (!subjectDid) {
      return res.status(400).json({ error: 'subjectDid is required' });
    }

    if (!isValidDecisionType(decisionType)) {
      return res.status(400).json({
        error: `Invalid decisionType — must be one of: ${VALID_DECISION_TYPES.join(', ')}`,
      });
    }

    if (credentialIds.length === 0) {
      return res.status(400).json({ error: 'At least one credentialId is required' });
    }

    try {
      const capsule = await capsuleEngine.createDecisionCapsule({
        subjectDid,
        subjectNpi,
        decisionType,
        credentialIds,
        issuerIds,
        metadata,
      });

      return res.status(201).json(capsule);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'decision_capsules: create failed', { error: message });
      return res.status(500).json({ error: 'Failed to create decision capsule' });
    }
  });

  /**
   * POST /api/decisions/cascade/:credentialId
   *
   * Trigger revocation cascade for a credential. Updates all dependent
   * decision capsules through the status lifecycle.
   */
  app.post(
    '/api/decisions/cascade/:credentialId',
    async (req: Request, res: Response) => {
      const { credentialId } = req.params;

      if (!credentialId) {
        return res.status(400).json({ error: 'credentialId is required' });
      }

      try {
        const result = await revocationCascade.propagateRevocation(credentialId);

        log('info', 'decision_capsules: cascade complete', {
          credentialId: credentialId.slice(0, 8) + '...',
          totalAffected: result.totalAffected,
        });

        return res.json(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        log('error', 'decision_capsules: cascade failed', { error: message });
        return res.status(500).json({ error: 'Failed to propagate revocation' });
      }
    },
  );
}
