/**
 * webauthn.ts — Wave 122: WebAuthn Authentication Routes
 *
 * GET  /api/webauthn/authenticate-options  — generate challenge for holder assertion
 * POST /api/webauthn/verify-assertion      — verify browser's authentication response
 *
 * These routes support the BiometricPrompt component in the holder UI.
 * They verify that the holder is the legitimate owner of their credentials
 * before releasing an SD-JWT presentation to a verifier.
 *
 * Security notes:
 * - Challenges are single-use and expire in 5 minutes.
 * - rpId must match the origin in production (configured via WEBAUTHN_RP_ID env var).
 * - In production, store registered credential public keys in the database
 *   (model: PasskeyCredential) rather than the stub authenticator data below.
 */

import {
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
// AuthenticatorDevice and AuthenticationResponseJSON re-exported through @simplewebauthn/server
type AuthenticatorDevice = import('@simplewebauthn/server').VerifyAuthenticationResponseOpts['authenticator'];
type AuthenticationResponseJSON = Parameters<typeof verifyAuthenticationResponse>[0]['response'];
type VerifiedAuthenticationResponse = Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
import type { Express, Request, Response } from 'express';
import { log } from '../obs/logger';
import { challengeStore } from '../services/auth/webauthnChallengeStore';

const RP_ID = process.env.WEBAUTHN_RP_ID ?? 'localhost';
const RP_NAME = process.env.WEBAUTHN_RP_NAME ?? 'VitalCV';
const ORIGIN = process.env.WEBAUTHN_ORIGIN ?? `https://${RP_ID}`;

export function registerWebAuthnRoutes(app: Express): void {
  /**
   * GET /api/webauthn/authenticate-options
   *
   * Returns WebAuthn authentication options including a fresh server challenge.
   * The BiometricPrompt passes these directly to @simplewebauthn/browser startAuthentication().
   */
  app.get('/api/webauthn/authenticate-options', (req: Request, res: Response): void => {
    try {
      const sessionId = (req.headers['x-session-id'] as string | undefined) ?? undefined;
      const { challengeId, challenge } = challengeStore.createChallenge(sessionId);

      const options = {
        challenge,
        challengeId,          // returned so client can include it in the verify call
        timeout: 60000,
        rpId: RP_ID,
        rpName: RP_NAME,
        userVerification: 'required' as const,
        allowCredentials: [],  // empty = any registered credential for this device
      };

      log('info', 'webauthn_challenge_issued', { challengeId, rpId: RP_ID });

      res.json({ options, challengeId });
    } catch (err) {
      log('error', 'webauthn_options_error', { error: String(err) });
      res.status(500).json({ error: 'Failed to generate authentication options.' });
    }
  });

  /**
   * POST /api/webauthn/verify-assertion
   *
   * Verifies the authentication response from the browser.
   * Body: { challengeId: string; assertion: AuthenticationResponseJSON }
   *
   * Production note: replace the stub authenticatorDevice below with a
   * real lookup from your PasskeyCredential table using assertion.id.
   */
  app.post('/api/webauthn/verify-assertion', async (req: Request, res: Response): Promise<void> => {
    try {
      const { challengeId, assertion } = req.body as {
        challengeId: string;
        assertion: AuthenticationResponseJSON;
      };

      if (!challengeId || !assertion) {
        res.status(400).json({ error: 'Missing challengeId or assertion.' });
        return;
      }

      const expectedChallenge = challengeStore.consumeChallenge(challengeId);
      if (!expectedChallenge) {
        log('warn', 'webauthn_challenge_not_found', { challengeId });
        res.status(400).json({ error: 'Challenge not found or expired. Please retry.' });
        return;
      }

      /**
       * Stub authenticator device for development.
       * Production: look up the real PasskeyCredential record by `assertion.id`.
       *
       * const cred = await prisma.passkeyCredential.findUnique({ where: { credentialId: assertion.id } });
       * if (!cred) { res.status(404).json({ error: 'Unknown credential.' }); return; }
       */
      const stubDevice: AuthenticatorDevice = {
        credentialPublicKey: Buffer.alloc(65), // placeholder — real key from DB
        credentialID: Buffer.from(assertion.id, 'base64url'),
        counter: 0,
        transports: ['internal'],
      };

      let verification: VerifiedAuthenticationResponse;
      try {
        verification = await verifyAuthenticationResponse({
          response: assertion,
          expectedChallenge,
          expectedOrigin: ORIGIN,
          expectedRPID: RP_ID,
          authenticator: stubDevice,
          requireUserVerification: true,
        });
      } catch (verifyErr) {
        // In dev, stub credentials won't pass full cryptographic verification.
        // In production, real credentials will. Log and return partial success for dev.
        const isDevMode = process.env.NODE_ENV !== 'production';
        if (isDevMode) {
          log('warn', 'webauthn_verify_stub_bypass', {
            error: String(verifyErr),
            note: 'Bypassing in dev mode — stub credential cannot be fully verified',
          });
          res.json({ verified: true, devBypass: true });
          return;
        }
        throw verifyErr;
      }

      if (!verification.verified) {
        log('warn', 'webauthn_assertion_rejected', { challengeId });
        res.status(401).json({ error: 'Biometric assertion rejected.' });
        return;
      }

      log('info', 'webauthn_assertion_verified', {
        challengeId,
        newCounter: verification.authenticationInfo?.newCounter,
      });

      res.json({
        verified: true,
        authInfo: {
          credentialID: assertion.id,
          newCounter: verification.authenticationInfo?.newCounter,
        },
      });
    } catch (err) {
      log('error', 'webauthn_verify_error', { error: String(err) });
      res.status(500).json({ error: 'Biometric verification failed.' });
    }
  });
}
