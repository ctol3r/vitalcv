import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { calculateJwkThumbprint } from 'jose';
import {
  AuthenticatedRequest,
  loadUserSession,
  requireAuth,
} from '../../../../backend/src/middleware/accessGuards';
import {
  DeviceBoundWalletRequest,
  requireDeviceBoundWallet,
} from '../../middleware/deviceBoundWallet';
import dpopGuard from '../../middleware/dpop';
import { PassportV3Builder } from 'services/passport/v3/builder';
import { PassportProofBinder } from 'services/passport/v3/proofBinder';
import { encryptPassportPayload } from 'services/passport/v3/encryption';
import { passportStore } from 'services/wallet/passportStore';
import { signPassportBundle } from 'services/passport/signPassport';
import { recordPassportBundle } from 'services/passport/models/PassportBundle';
import { PrismaClient } from '@prisma/client';
import { assertKillSwitchAllows, KillSwitchError } from '../../services/security/kill-switch';
import {
  assertIssuanceAllowed,
  ForensicsLockError,
} from '../../services/forensics/score';

const prisma = new PrismaClient();
const builder = new PassportV3Builder(prisma);
const proofBinder = new PassportProofBinder({ prisma });
const router = Router();

const IssuePassportSchema = z.object({
  clinicianId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

router.post(
  '/issue',
  loadUserSession,
  requireAuth,
  requireDeviceBoundWallet,
  dpopGuard(),
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const walletReq = req as DeviceBoundWalletRequest;
    const dpop = (req as any).dpop as { jkt?: string } | undefined;

    if (!walletReq.walletBinding?.secret) {
      return res.status(400).json({
        error: 'wallet_secret_required',
        message: 'Missing wallet binding secret.',
      });
    }

    try {
      assertKillSwitchAllows('issuance');

      const payload = IssuePassportSchema.parse(req.body ?? {});
      const clinicianId =
        payload.clinicianId ?? (await resolveClinicianId(authReq.user?.id));
      if (!clinicianId) {
        return res.status(404).json({
          error: 'clinician_not_found',
          message: 'Clinician profile not found for current user.',
        });
      }

      try {
        await assertIssuanceAllowed(clinicianId);
      } catch (error) {
        if (error instanceof ForensicsLockError) {
          return res.status(423).json({
            error: 'forensics_lock',
            message: error.message,
            clinicianId: error.clinicianId,
            riskScore: error.riskScore,
            threshold: error.threshold,
          });
        }
        throw error;
      }

      const walletDevice = await prisma.walletDevice.findUnique({
        where: { deviceId: walletReq.walletBinding.walletId },
      });

      if (!walletDevice) {
        return res.status(404).json({
          error: 'wallet_device_not_found',
          message: 'No registered wallet device for provided identifier.',
        });
      }

      if (dpop?.jkt) {
        const thumbprint = await calculateJwkThumbprint(
          walletDevice.publicKeyJwk as any,
        );
        if (thumbprint !== dpop.jkt) {
          return res.status(401).json({
            error: 'dpop_mismatch',
            message: 'DPoP proof does not match registered wallet device.',
          });
        }
      }

      const envelope = await builder.build({
        clinicianId,
        userId: authReq.user?.id,
        deviceBinding: {
          walletId: walletReq.walletBinding.walletId,
          dpopJkt: dpop?.jkt,
        },
      });

      const envelopeWithProofs = await proofBinder.bind(envelope);

      const anchor = await signPassportBundle({
        bundleId: envelopeWithProofs.passportId,
        clinicianId,
        userId: String(authReq.user?.id ?? ''),
        bundleHash: envelopeWithProofs.bundleHash!,
        manifest: envelopeWithProofs.manifest,
      });

      envelopeWithProofs.signature = anchor;

      await recordPassportBundle({
        clinicianId,
        bundleHash: envelopeWithProofs.bundleHash!,
      });

      const encrypted = encryptPassportPayload(
        Buffer.from(JSON.stringify(envelopeWithProofs), 'utf-8'),
        walletReq.walletBinding.secret,
      );

      await passportStore.save({
        passportId: envelopeWithProofs.passportId,
        clinicianId,
        deviceId: walletReq.walletBinding.walletId,
        version: envelopeWithProofs.version,
        hash: envelopeWithProofs.bundleHash!,
        issuedAt: envelopeWithProofs.issuedAt,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        envelopeSummary: envelopeWithProofs.summary,
        signature: anchor,
        metadata: payload.metadata,
        channel: 'device',
      });

      await passportStore.revokeOlderVersions(
        clinicianId,
        envelopeWithProofs.passportId,
        'superseded_by_new_issue',
      );

      res.status(201).json({
        passportId: envelopeWithProofs.passportId,
        version: envelopeWithProofs.version,
        hash: envelopeWithProofs.bundleHash,
        anchor,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        summary: envelopeWithProofs.summary,
        proofs: envelopeWithProofs.proofs,
      });
    } catch (error: any) {
      if (error instanceof KillSwitchError) {
        return res.status(503).json({
          error: 'kill_switch_engaged',
          message: error.message,
          killSwitch: error.state,
        });
      }
      if (error instanceof ForensicsLockError) {
        return res.status(423).json({
          error: 'forensics_lock',
          message: error.message,
          clinicianId: error.clinicianId,
          riskScore: error.riskScore,
          threshold: error.threshold,
        });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'invalid_request',
          details: error.issues,
        });
      }

      console.error('[passportV3][issue]', error);
      return res.status(500).json({
        error: 'passport_issue_failed',
        message: error.message ?? 'Failed to issue passport',
      });
    } finally {
      if (walletReq.walletBinding?.secret) {
        walletReq.walletBinding.secret.fill(0);
      }
    }
  },
);

async function resolveClinicianId(userId?: string | number): Promise<string | null> {
  if (!userId) {
    return null;
  }

  const clinician = await prisma.clinicianProfile.findFirst({
    where: { userId: String(userId) },
    select: { id: true },
  });

  return clinician?.id ?? null;
}

export default router;

