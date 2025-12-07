import { Router, Request, Response } from 'express';
import { createCipheriv, randomBytes } from 'crypto';
import {
  AuthenticatedRequest,
  loadUserSession,
  requireAuth,
} from '../../../../../backend/src/middleware/accessGuards';
import {
  DeviceBoundWalletRequest,
  requireDeviceBoundWallet,
} from '../../middleware/deviceBoundWallet';
import { generatePassportBundle } from 'services/passport/generateBundle';
import { recordPassportBundle } from 'services/passport/models/PassportBundle';
import { signPassportBundle } from 'services/passport/signPassport';

const router = Router();

router.get(
  '/download',
  loadUserSession,
  requireAuth,
  requireDeviceBoundWallet,
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const walletReq = req as DeviceBoundWalletRequest;

    if (!authReq.user?.id) {
      return res.status(401).json({
        error: 'authentication_required',
        message: 'User session missing from request.',
      });
    }

    try {
      const bundle = await generatePassportBundle({
        clinicianId: (req.query.clinicianId as string) || undefined,
        userId: String(authReq.user.id),
      });

      await recordPassportBundle({
        clinicianId: bundle.clinicianId,
        bundleHash: bundle.bundleHash,
      });

      const anchor = await signPassportBundle({
        bundleId: bundle.bundleId,
        clinicianId: bundle.clinicianId,
        userId: bundle.userId,
        bundleHash: bundle.bundleHash,
        manifest: bundle.manifest,
      });

      const encrypted = encryptForWallet(bundle.zipBuffer, walletReq.walletBinding!.secret);

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${bundle.bundleId}.enc"`);
      res.setHeader('x-passport-iv', encrypted.iv);
      res.setHeader('x-passport-tag', encrypted.authTag);
      res.setHeader('x-passport-anchor-id', anchor.anchorId);
      res.setHeader('x-passport-signature', anchor.signature);
      res.setHeader('x-passport-public-key', anchor.publicKey);
      res.setHeader('x-passport-hash', bundle.bundleHash);
      res.setHeader('cache-control', 'no-store');

      return res.status(200).send(encrypted.ciphertext);
    } catch (error) {
      console.error('[passport][download] bundle generation failed', error);
      const message = error instanceof Error ? error.message : 'Failed to generate passport bundle';
      const status = /not found/i.test(message) ? 404 : 500;
      return res.status(status).json({
        error: 'passport_generation_failed',
        message,
      });
    } finally {
      if (walletReq.walletBinding) {
        walletReq.walletBinding.secret.fill(0);
      }
    }
  },
);

function encryptForWallet(payload: Buffer, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

export default router;

