import { Router, type Request, type Response } from 'express';
import {
  validateDIDDocument,
  bindSecureEnclave,
  hardenIssuer,
  proofVerifierIdentity,
  applyRiskBasedPolicy,
  anchorDIDTrustState,
  getIdentityAuditTimeline,
} from '@/services/identity/hardening';

const router = Router();

// Validate DID document
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { did } = req.body;
    if (!did) {
      return res.status(400).json({ error: 'did required' });
    }

    const result = await validateDIDDocument(did);
    return res.json(result);
  } catch (error) {
    console.error('[IdentityHardening] Validation failed', error);
    return res.status(500).json({
      error: 'validation_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Bind secure enclave
router.post('/enclave/bind', async (req: Request, res: Response) => {
  try {
    const { did, enclavePublicKey, metadata } = req.body;
    if (!did || !enclavePublicKey) {
      return res.status(400).json({ error: 'did and enclavePublicKey required' });
    }

    const result = await bindSecureEnclave(did, enclavePublicKey, metadata);
    return res.json(result);
  } catch (error) {
    console.error('[IdentityHardening] Enclave binding failed', error);
    return res.status(500).json({
      error: 'enclave_binding_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Harden issuer
router.post('/issuer/harden', async (req: Request, res: Response) => {
  try {
    const { issuerDid, mTLSRequired, rotationScheduleDays } = req.body;
    if (!issuerDid) {
      return res.status(400).json({ error: 'issuerDid required' });
    }

    const result = await hardenIssuer(
      issuerDid,
      mTLSRequired ?? true,
      rotationScheduleDays ?? 90,
    );
    return res.json(result);
  } catch (error) {
    console.error('[IdentityHardening] Issuer hardening failed', error);
    return res.status(500).json({
      error: 'issuer_hardening_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Proof verifier identity
router.post('/verifier/proof', async (req: Request, res: Response) => {
  try {
    const { verifierDid, domain, orgRegistration } = req.body;
    if (!verifierDid || !domain) {
      return res.status(400).json({ error: 'verifierDid and domain required' });
    }

    const result = await proofVerifierIdentity(verifierDid, domain, orgRegistration);
    return res.json(result);
  } catch (error) {
    console.error('[IdentityHardening] Verifier proofing failed', error);
    return res.status(500).json({
      error: 'verifier_proofing_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Apply risk-based policy
router.post('/risk-policy', async (req: Request, res: Response) => {
  try {
    const { did, riskScore } = req.body;
    if (!did || typeof riskScore !== 'number') {
      return res.status(400).json({ error: 'did and riskScore (number) required' });
    }

    const result = await applyRiskBasedPolicy(did, riskScore);
    return res.json(result);
  } catch (error) {
    console.error('[IdentityHardening] Risk policy failed', error);
    return res.status(500).json({
      error: 'risk_policy_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get audit timeline
router.get('/:did/timeline', async (req: Request, res: Response) => {
  try {
    const { did } = req.params;
    const result = await getIdentityAuditTimeline(did);
    return res.json(result);
  } catch (error) {
    console.error('[IdentityHardening] Timeline failed', error);
    return res.status(500).json({
      error: 'timeline_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get hardening status
router.get('/:did', async (req: Request, res: Response) => {
  try {
    const { did } = req.params;
    const { prisma } = await import('@/lib/prisma');
    const hardening = await prisma.identityHardening.findUnique({
      where: { did },
    });

    if (!hardening) {
      return res.status(404).json({ error: 'hardening_not_found' });
    }

    return res.json(hardening);
  } catch (error) {
    console.error('[IdentityHardening] Get failed', error);
    return res.status(500).json({
      error: 'get_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

