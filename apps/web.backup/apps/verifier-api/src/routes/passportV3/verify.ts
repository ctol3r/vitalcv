import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient, NCIVerifiableProofType } from '@prisma/client';
import { passportStore } from 'services/wallet/passportStore';
import { verifyPassportCredential } from 'services/passport/v3/verifier';
import { VerifiableProofRegistry } from 'services/nci/verifiableProofRegistry';

const PASSPORT_SIGNING_PUBLIC_KEY =
  process.env.PASSPORT_SIGNING_PUBLIC_KEY || process.env.PASSPORT_PUBLIC_KEY || '';

if (!PASSPORT_SIGNING_PUBLIC_KEY) {
  console.warn(
    '[verifier][passportV3] PASSPORT_SIGNING_PUBLIC_KEY is not configured. Requests will fail.',
  );
}

const prisma = new PrismaClient();
const proofRegistry = new VerifiableProofRegistry(prisma);
const router = Router();

const VerifyPassportSchema = z.object({
  sdJwt: z.string().min(1),
  disclosures: z.array(z.string()).default([]),
});

router.post('/verify', async (req: Request, res: Response) => {
  try {
    if (!PASSPORT_SIGNING_PUBLIC_KEY) {
      return res.status(500).json({
        valid: false,
        error: 'signing_key_missing',
        message: 'Passport signing public key is not configured on verifier.',
      });
    }

    const payload = VerifyPassportSchema.parse(req.body ?? {});
    const verification = await verifyPassportCredential({
      sdJwt: payload.sdJwt,
      disclosures: payload.disclosures,
      publicKeyHex: PASSPORT_SIGNING_PUBLIC_KEY,
    });

    const storedRecord = await passportStore.getPassport(verification.passportId);
    if (!storedRecord) {
      return res.status(404).json({
        valid: false,
        error: 'passport_not_found',
        message: 'Passport hash not registered in wallet store.',
      });
    }

    if (storedRecord.revokedAt) {
      return res.status(410).json({
        valid: false,
        error: 'passport_revoked',
        message: 'Passport has been revoked.',
        revokedAt: storedRecord.revokedAt.toISOString(),
      });
    }

    const storedHash = (storedRecord.payload as any).hash;
    if (storedHash !== verification.hash) {
      return res.status(400).json({
        valid: false,
        error: 'hash_mismatch',
        message: 'Credential hash does not match stored passport hash.',
      });
    }

    const nciProofs = await proofRegistry.listProofs(
      verification.payload.sub,
      NCIVerifiableProofType.ISSUANCE,
    );

    if (!nciProofs.length) {
      return res.status(400).json({
        valid: false,
        error: 'nci_anchor_missing',
        message: 'No NCI issuance proof found for holder DID.',
      });
    }

    return res.json({
      valid: true,
      passportId: verification.passportId,
      credentialId: verification.credentialId,
      domain: verification.domain,
      hash: verification.hash,
      revealedClaims: verification.disclosedClaims,
      nciProofs: nciProofs.map((proof) => ({
        proofId: proof.id,
        proofType: proof.proofType,
        recordedAt: proof.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        valid: false,
        error: 'invalid_request',
        details: error.issues,
      });
    }

    return res.status(400).json({
      valid: false,
      error: 'verification_failed',
      message: error.message || 'Unable to verify passport credential',
    });
  }
});

export default router;

