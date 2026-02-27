import crypto from 'node:crypto';
import type { Express, Request, Response } from 'express';
import { verifyPresentation } from '../services/verifier/sdJwtVerifier';
import type { VerificationResult } from '../services/verifier/sdJwtVerifier';

// ── Session store ────────────────────────────────────────────────────

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface VpSession {
  id: string;
  status: 'pending' | 'verified' | 'failed';
  result?: VerificationResult;
  createdAt: string;
  expiresAt: string;
}

const sessions = new Map<string, VpSession>();

function makeSession(id: string): VpSession {
  const now = new Date();
  const session: VpSession = {
    id,
    status: 'pending',
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
  };
  sessions.set(id, session);
  return session;
}

function isExpired(session: VpSession): boolean {
  return new Date(session.expiresAt).getTime() < Date.now();
}

// ── Route registration ───────────────────────────────────────────────

export function registerOidc4vpRoutes(app: Express): void {
  /**
   * GET /api/verifier/presentation-request/:id
   *
   * Returns an OpenID4VP Presentation Request that a holder wallet can consume.
   * Creates a pending session if one doesn't exist for the given ID.
   */
  app.get('/api/verifier/presentation-request/:id', (req: Request, res: Response) => {
    const sessionId = req.params.id;
    const existing = sessions.get(sessionId);

    if (!existing) {
      makeSession(sessionId);
    }

    const nonce = crypto.randomBytes(16).toString('hex');

    return res.status(200).json({
      id: sessionId,
      response_type: 'vp_token',
      response_mode: 'direct_post',
      client_id: 'did:web:verifier.vitalcv.com',
      response_uri:
        'https://api.vitalcv.com/api/verifier/submit-response/' + sessionId,
      nonce,
      presentation_definition: {
        id: 'vitalcv-medical-license-' + sessionId,
        input_descriptors: [
          {
            id: 'medical_license_credential',
            name: 'Medical License Credential',
            purpose:
              'Verify active medical license for provider credentialing',
            constraints: {
              fields: [
                {
                  path: ['$.vct'],
                  filter: { type: 'string', const: 'MedicalLicense' },
                },
                {
                  path: ['$.status'],
                  filter: { type: 'string', enum: ['valid'] },
                },
              ],
            },
          },
        ],
      },
    });
  });

  /**
   * POST /api/verifier/submit-response/:id
   *
   * Accepts a VP token from the holder wallet, verifies it, and updates the session.
   * Uses wildcard issuer matching ("*") for demo — any issuer is accepted.
   */
  app.post('/api/verifier/submit-response/:id', (req: Request, res: Response) => {
    const sessionId = req.params.id;
    const body = req.body as Record<string, unknown>;
    const vpToken = body.vp_token;

    if (!vpToken || typeof vpToken !== 'string') {
      return res.status(400).json({ error: 'vp_token required' });
    }

    try {
      // Get or create session
      let session = sessions.get(sessionId);
      if (!session) {
        session = makeSession(sessionId);
      }

      // Check expiry
      if (isExpired(session)) {
        return res.status(410).json({ status: 'expired' });
      }

      // Verify the VP token (wildcard issuer for demo)
      const result = verifyPresentation(vpToken, '*');

      // Update session
      session.status = result.isValid ? 'verified' : 'failed';
      session.result = result;

      if (result.isValid) {
        return res.status(200).json({
          status: 'success',
          redirect_uri: 'https://app.vitalcv.com/holder?verified=1',
          audit_hash: result.auditHash,
        });
      }

      return res.status(200).json({
        status: 'rejected',
        reason: 'issuer_mismatch_or_invalid_token',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'unknown error';
      return res.status(500).json({
        error: 'verification_failed',
        detail: message,
      });
    }
  });

  /**
   * GET /api/verifier/status/:id
   *
   * Polling endpoint for the frontend to check verification progress.
   */
  app.get('/api/verifier/status/:id', (req: Request, res: Response) => {
    const sessionId = req.params.id;
    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ status: 'not_found' });
    }

    if (isExpired(session)) {
      return res.status(410).json({ status: 'expired' });
    }

    return res.status(200).json({
      status: session.status,
      verified_at: session.result?.verifiedAt ?? null,
      issuer: session.result?.issuer ?? null,
      vct: session.result?.vct ?? null,
    });
  });
}
