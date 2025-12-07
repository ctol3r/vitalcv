/**
 * OIDC4VP Routes
 * OIDC-VP-010: Presentation Request + QR Flow
 *
 * Implements OpenID for Verifiable Presentations (OIDC4VP)
 */

import { Router, Request, Response } from 'express';
import { verifyCredential } from '../services/vc-verification-service';
import * as crypto from 'crypto';

// QRCode and uuid will need to be installed via npm
// For now, using placeholder implementations
async function generateQRCode(text: string): Promise<string> {
  // Placeholder - install qrcode package: npm install qrcode @types/qrcode
  // For now, return data URI placeholder
  return `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg"><text>${text}</text></svg>`
  ).toString('base64')}`;
}

function generateUUID(): string {
  return crypto.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const router = Router();

// In-memory store for presentation sessions (use Redis in production)
const presentationSessions = new Map<string, PresentationSession>();

export interface PresentationSession {
  id: string;
  request_uri: string;
  client_id: string;
  nonce: string;
  state: string;
  response_uri: string;
  createdAt: Date;
  expiresAt: Date;
  verified?: boolean;
  presentation?: any;
}

/**
 * POST /oidc/presentation/request
 * Create a new presentation request
 *
 * Generates a request_uri and QR code for wallet scanning
 */
router.post('/presentation/request', async (req: Request, res: Response) => {
  try {
    const {
      client_id,
      response_uri,
      nonce,
      state,
      presentation_definition,
    } = req.body;

    if (!client_id || !response_uri) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'client_id and response_uri are required',
      });
    }

    // Generate request URI
    const sessionId = generateUUID();
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const request_uri = `${baseUrl}/oidc/presentation/request/${sessionId}`;

    // Generate nonce and state if not provided
    const generatedNonce = nonce || generateNonce();
    const generatedState = state || generateNonce();

    // Create session
    const session: PresentationSession = {
      id: sessionId,
      request_uri,
      client_id,
      nonce: generatedNonce,
      state: generatedState,
      response_uri,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    };

    presentationSessions.set(sessionId, session);

    // Generate QR code
    const qrCodeUrl = await generateQRCode(request_uri);

    // Build presentation request
    const presentationRequest = {
      request_uri,
      client_id,
      nonce: generatedNonce,
      state: generatedState,
      response_uri,
      presentation_definition: presentation_definition || {
        id: 'vp_request',
        input_descriptors: [
          {
            id: 'medical_license',
            name: 'Medical License',
            purpose: 'We need to verify your medical license',
            constraints: {
              fields: [
                {
                  path: ['$.credentialSubject.licenseNumber'],
                  filter: {
                    type: 'string',
                  },
                },
              ],
            },
          },
        ],
      },
    };

    return res.json({
      request_uri,
      qr_code: qrCodeUrl,
      expires_in: 600, // 10 minutes
      presentation_request: presentationRequest,
    });
  } catch (error) {
    console.error('Presentation request error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /oidc/presentation/request/:sessionId
 * Get presentation request by session ID
 *
 * Called by wallet after scanning QR code
 */
router.get('/presentation/request/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = presentationSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({
      error: 'invalid_request',
      error_description: 'Presentation request not found',
    });
  }

  if (session.expiresAt < new Date()) {
    presentationSessions.delete(sessionId);
    return res.status(410).json({
      error: 'expired',
      error_description: 'Presentation request has expired',
    });
  }

  return res.json({
    client_id: session.client_id,
    nonce: session.nonce,
    state: session.state,
    response_uri: session.response_uri,
    presentation_definition: {
      id: 'vp_request',
      input_descriptors: [
        {
          id: 'verifiable_credential',
          name: 'Verifiable Credential',
          purpose: 'Please present your verifiable credential',
          constraints: {
            fields: [],
          },
        },
      ],
    },
  });
});

/**
 * POST /oidc/presentation/submit
 * Submit verifiable presentation
 *
 * Validates the presentation using the verification service
 */
router.post('/presentation/submit', async (req: Request, res: Response) => {
  try {
    const {
      state,
      vp_token,
      presentation_submission,
    } = req.body;

    if (!state || !vp_token) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'state and vp_token are required',
      });
    }

    // Find session by state
    const session = Array.from(presentationSessions.values()).find(
      (s) => s.state === state
    );

    if (!session) {
      return res.status(404).json({
        error: 'invalid_state',
        error_description: 'Invalid or expired state',
      });
    }

    if (session.expiresAt < new Date()) {
      presentationSessions.delete(session.id);
      return res.status(410).json({
        error: 'expired',
        error_description: 'Presentation request has expired',
      });
    }

    // Parse VP token (can be JWT or JSON)
    let presentation: any;
    if (typeof vp_token === 'string') {
      // JWT format - decode it
      try {
        const parts = vp_token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
          presentation = payload.vp || payload;
        } else {
          presentation = JSON.parse(vp_token);
        }
      } catch (error) {
        return res.status(400).json({
          error: 'invalid_vp_token',
          error_description: 'Invalid VP token format',
        });
      }
    } else {
      presentation = vp_token;
    }

    // Verify all credentials in the presentation
    const verifiableCredentials = presentation.verifiableCredential || [];
    if (!Array.isArray(verifiableCredentials)) {
      return res.status(400).json({
        error: 'invalid_presentation',
        error_description: 'verifiableCredential must be an array',
      });
    }

    const verificationResults = await Promise.all(
      verifiableCredentials.map((cred: any) =>
        verifyCredential({
          credential: cred,
          options: {
            checks: ['proof', 'expiration', 'issuance', 'status'],
            challenge: session.nonce,
          },
        })
      )
    );

    // Check if all credentials are valid
    const allValid = verificationResults.every((result) => result.verified);
    const errors = verificationResults
      .filter((result) => !result.verified)
      .flatMap((result) => result.errors || []);

    if (!allValid) {
      return res.status(400).json({
        error: 'verification_failed',
        error_description: 'One or more credentials failed verification',
        errors,
        verification_results: verificationResults,
      });
    }

    // TODO: Check status against on-chain status list (LEDGER-012 integration)
    // This should query the blockchain for revocation status

    // Mark session as verified
    session.verified = true;
    session.presentation = presentation;

    // Redirect to response URI with success
    const redirectUrl = new URL(session.response_uri);
    redirectUrl.searchParams.set('state', session.state);
    redirectUrl.searchParams.set('vp_token', typeof vp_token === 'string' ? vp_token : JSON.stringify(vp_token));

    // Optionally return JSON response instead of redirect
    if (req.headers.accept?.includes('application/json')) {
      return res.json({
        state: session.state,
        verified: true,
        verification_results: verificationResults,
      });
    }

    // Redirect to response URI
    return res.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('Presentation submission error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /oidc/presentation/status/:sessionId
 * Check presentation verification status
 */
router.get('/presentation/status/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = presentationSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({
      error: 'not_found',
      error_description: 'Session not found',
    });
  }

  return res.json({
    id: session.id,
    verified: session.verified || false,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    ...(session.verified && {
      verifiedAt: new Date().toISOString(),
    }),
  });
});

/**
 * Generate random nonce
 */
function generateNonce(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64url');
}

export default router;

