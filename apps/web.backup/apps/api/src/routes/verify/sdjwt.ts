import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  buildDigestLookup,
  computeDisclosureDigest,
  hydrateDisclosedClaims,
  verifySdJwtSignature,
  type Json,
} from '../../services/credentials/sdjwt';

const router = Router();

const VerifyRequestSchema = z.object({
  sd_jwt: z.string().min(1),
  disclosures: z
    .array(
      z.object({
        path: z.string().min(1),
        value: z.any(),
        salt: z.string().min(1),
        digest: z.string().optional(),
      }),
    )
    .default([]),
});

router.post('/', async (req: Request, res: Response) => {
  const parseResult = VerifyRequestSchema.safeParse(req.body ?? {});
  if (!parseResult.success) {
    return res.status(400).json({
      valid: false,
      error: 'invalid_request',
      details: parseResult.error.flatten(),
    });
  }

  const { sd_jwt, disclosures } = parseResult.data;

  try {
    const verification = await verifySdJwtSignature(sd_jwt);
    const digestLookup = buildDigestLookup(verification.payload.sd_digests ?? []);

    const recomputed = disclosures.map((entry) => ({
      ...entry,
      digest: computeDisclosureDigest(entry.path, entry.value as Json, entry.salt),
    }));

    const mismatched = recomputed.filter((entry) => digestLookup[entry.path] !== entry.digest);
    const valid = mismatched.length === 0;

    const visibleClaims = hydrateDisclosedClaims(
      recomputed.map(({ path, value }) => ({ path, value })),
    );

    return res.status(200).json({
      valid,
      visibleClaims,
      issuer: {
        did: verification.payload.iss ?? null,
        keyId: verification.header.kid ?? null,
        issuedAt: verification.payload.iat ?? null,
        digestRoot: verification.payload.digest_root ?? null,
        credentialId:
          verification.payload.credential_id ?? (verification.payload.jti as string | null) ?? null,
      },
      invalidDisclosures: mismatched.map((entry) => entry.path),
    });
  } catch (error) {
    console.error('[verify][sdjwt]', error);
    return res.status(400).json({
      valid: false,
      error: 'verification_failed',
      message: error instanceof Error ? error.message : 'Unable to verify SD-JWT token',
    });
  }
});

export default router;











