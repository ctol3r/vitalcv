import { Router } from 'express';
import { z } from 'zod';
import { validateChainRealTime, validateMultiProofBundle } from '@/services/verifier';
import { anchorVerifierCheck } from '@/services/verifier/anchor';

const router = Router();

// Verify credential
router.post('/verify', async (req, res) => {
  try {
    const { credentialId, vcProof, proofBundle, verifierId } = z
      .object({
        credentialId: z.string(),
        vcProof: z.record(z.unknown()).optional(),
        proofBundle: z.record(z.unknown()).optional(),
        verifierId: z.string(),
      })
      .parse(req.body);

    let validationResult;

    if (proofBundle) {
      // Multi-proof bundle validation
      const multiResult = validateMultiProofBundle(proofBundle as any);
      validationResult = {
        type: 'multi_proof',
        ...multiResult,
      };
    } else {
      // Chain validation
      const chainResult = await validateChainRealTime(credentialId, vcProof);
      validationResult = {
        type: 'chain',
        ...chainResult,
      };
    }

    // Anchor check
    await anchorVerifierCheck(verifierId, validationResult);

    res.json(validationResult);
  } catch (error) {
    console.error('[verifier] check error', error);
    res.status(500).json({ error: 'Failed to verify credential' });
  }
});

export default router;

