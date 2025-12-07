import { Request, Response, Router } from 'express';
import { emitEvent } from '../agents/bus';
import { npiClaimService } from '../services/npi_claim_service';
import { nppesClient } from '../services/nppes_client';

const router = Router();

/**
 * GET /api/npi/lookup?npi=<npi>
 * Lookup NPI details from NPPES registry.
 */
router.get('/lookup', async (req: Request, res: Response) => {
  try {
    const { npi } = req.query;

    if (!npi || typeof npi !== 'string') {
      return res.status(400).json({ error: 'NPI parameter is required' });
    }

    // Validate NPI format (10 digits)
    if (!/^\d{10}$/.test(npi)) {
      return res.status(400).json({ error: 'Invalid NPI format. Must be 10 digits.' });
    }

    const details = await nppesClient.fetch(npi);

    if (!details) {
      return res.status(404).json({ error: 'NPI not found', code: 'NPI_NOT_FOUND' });
    }

    // Emit passive "view" event to kick auto-tagger early (non-blocking)
    emitEvent({ type: 'NPLOOKUP_VIEW', npi: details.number || npi });

    return res.json(details);
  } catch (error: any) {
    console.error('NPI lookup error:', error);

    // Enhanced error handling
    if (error.message?.includes('NPPES_ERROR')) {
      return res.status(502).json({
        error: 'NPPES lookup failed (network)',
        code: 'NPPES_NETWORK',
        details: error.message,
      });
    }

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return res.status(504).json({
        error: 'NPPES lookup timeout',
        code: 'NPPES_TIMEOUT',
        details: error.message,
      });
    }

    return res.status(500).json({
      error: 'Failed to lookup NPI',
      code: 'LOOKUP_ERROR',
      details: error.message,
    });
  }
});

/**
 * POST /api/claim/basic
 * Start Level 1 claim by issuing OTP.
 */
router.post('/claim/basic', async (req: Request, res: Response) => {
  try {
    const { npi, email } = req.body;

    if (!npi || !email) {
      return res.status(400).json({ error: 'NPI and email are required' });
    }

    // Validate NPI format
    if (!/^\d{10}$/.test(npi)) {
      return res.status(400).json({ error: 'Invalid NPI format. Must be 10 digits.' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const result = await npiClaimService.startLevel1Claim({ npi, email });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Emit event for agent processing
    emitEvent({ type: 'CLAIM_START', npi });

    return res.json({
      success: true,
      message: 'OTP sent to email',
      expiresAt: result.expiresAt,
    });
  } catch (error: any) {
    console.error('Level 1 claim error:', error);
    return res.status(500).json({ error: 'Failed to start claim', details: error.message });
  }
});

/**
 * POST /api/claim/verify-pin
 * Verify OTP and complete Level 1 claim.
 */
router.post('/claim/verify-pin', async (req: Request, res: Response) => {
  try {
    const { npi, pin } = req.body;

    if (!npi || !pin) {
      return res.status(400).json({ error: 'NPI and PIN are required' });
    }

    const result = await npiClaimService.verifyLevel1Claim({ npi, pin });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Emit event for agent processing
    emitEvent({ type: 'CLAIM_VERIFY_PIN', npi });

    return res.json({
      success: true,
      level: result.level,
      userId: result.userId,
      did: result.did,
      roles: result.roles,
    });
  } catch (error: any) {
    console.error('Level 1 verify error:', error);
    return res.status(500).json({ error: 'Failed to verify PIN', details: error.message });
  }
});

/**
 * GET /api/claim/:npi
 * Get claim details for a given NPI.
 */
router.get('/claim/:npi', async (req: Request, res: Response) => {
  try {
    const { npi } = req.params;

    if (!/^\d{10}$/.test(npi)) {
      return res.status(400).json({ error: 'Invalid NPI format' });
    }

    const claim = await npiClaimService.getClaimByNpi(npi);

    if (!claim) {
      return res.status(404).json({ error: 'Claim not found' });
    }

    // Build comprehensive status response
    const status = {
      npi: claim.npi,
      level: claim.level,
      userId: claim.userId,
      did: claim.user?.did,
      roles: claim.user?.roles || [],
      emailVerified: claim.level >= 1, // Level 1+ means email verified
      phoneVerified: false, // Not implemented yet
      identityConfidence: claim.evidence?.identityConfidence || null,
      evidence: claim.evidence,
      tags: claim.tags || {}, // Agent-generated tags for UX/routing
      issuerAttestationTx: claim.issuerAttestationTx,
      lastVerifiedAt: claim.lastVerifiedAt,
      createdAt: claim.createdAt,
      updatedAt: claim.updatedAt,
    };

    return res.json(status);
  } catch (error: any) {
    console.error('Get claim error:', error);
    return res.status(500).json({ error: 'Failed to get claim', details: error.message });
  }
});

export default router;
