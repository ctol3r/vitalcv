/**
 * Pilot Request API — wave-135
 *
 * POST /api/pilot-request
 * Receives a pilot conversion from the employer decision console.
 * Logs context: which clinician triggered it, blockers present, decision state.
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';

export const pilotRequestRouter = Router();

pilotRequestRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
      org, contactEmail, timestamp, sourceEntityId, sourceNpi,
      decisionState, posture, blockerCount, proofTier, score, lanes,
    } = req.body;

    if (!org || !contactEmail) {
      return res.status(400).json({ error: 'org and contactEmail required' });
    }

    const requestId = randomUUID();

    // Write audit event for conversion tracking
    await prisma.auditEvent.create({
      data: {
        type: 'pilot.requested',
        hash: randomUUID(),
        referenceId: requestId,
        clinicianId: sourceNpi ?? null,
        metadata: {
          requestId,
          org,
          contactEmail,
          sourceEntityId,
          sourceNpi,
          decisionState,
          posture,
          blockerCount,
          proofTier,
          score,
          laneCount: lanes?.length ?? 0,
          laneStatuses: lanes?.map((l: any) => `${l.laneId}:${l.status}`),
          submittedAt: new Date(timestamp ?? Date.now()).toISOString(),
        },
      },
    });

    log('info', 'pilot_requested', {
      requestId,
      org,
      posture,
      decisionState,
      blockerCount,
      proofTier,
    });

    return res.json({
      ok: true,
      requestId,
      message: 'Pilot request received. Follow-up within 24 hours.',
    });
  } catch (err: any) {
    log('error', 'pilot_request_failed', { error: err.constructor?.name });
    return res.status(500).json({ error: 'Internal error' });
  }
});
