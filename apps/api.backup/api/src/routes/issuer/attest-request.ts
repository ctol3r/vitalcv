import { Router, Request, Response } from 'express';

const router = Router();

/**
 * POST /api/issuer/attest-request
 * Request attestation from an issuer (Level 3).
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { npi, userId, requestedBy } = req.body;

    if (!npi || !userId) {
      return res.status(400).json({ error: 'NPI and userId are required' });
    }

    // Try to import from backend if available
    try {
      const { level3ClaimService } = await import('../../../../backend/src/services/level3_claim_service');
      const { emitEvent } = await import('../../../../backend/src/agents/bus');

      const result = await level3ClaimService.requestAttestation({
        npi,
        userId: parseInt(userId),
        requestedBy: requestedBy || 'user',
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      // Emit event for agent processing
      emitEvent({ type: 'ATTEST_REQUESTED', npi });

      return res.json({
        success: true,
        requestId: result.requestId,
        message:
          'Attestation request submitted. You will be notified when an issuer signs your credential.',
      });
    } catch (importError) {
      console.warn('Backend services not available, using fallback');
      res.status(501).json({ error: 'Attestation service not configured' });
    }
  } catch (error: any) {
    console.error('Level 3 attestation request error:', error);
    return res.status(500).json({ error: 'Failed to request attestation', details: error.message });
  }
});

export default router;

