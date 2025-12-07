/**
 * DC-001: OID4VP Presentation Request Controller
 * Generates presentation_definition and OIDC request parameters for verifiers
 */

import { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import prisma from '../graphql/prisma_client';
import { PresentationDefinitionService } from './presentationDefinitionService';
import { generatePresentationDefinition, getPolicy, type VerifierWorkflow } from './policy/verifierPolicy';
import { auditLog } from '../controllers/audit';

const VERIFIER_BASE_URL = process.env.PUBLIC_VERIFIER_URL || process.env.VERIFIER_URL || 'https://vitalcv.ai';
const SESSION_TTL_MINUTES = parseInt(process.env.OID4VP_SESSION_TTL_MINUTES || '15', 10);

/**
 * Generate a secure nonce
 */
function generateNonce(): string {
  return randomBytes(16).toString('base64url');
}

/**
 * Generate a secure state
 */
function generateState(): string {
  return randomBytes(16).toString('base64url');
}

/**
 * POST /api/oid4vp/request
 *
 * Generates an OID4VP presentation request with:
 * - presentation_definition (either from policy or saved definition)
 * - nonce and state for replay protection
 * - OIDC request URL
 * - QR code payload
 */
export async function createPresentationRequest(req: Request, res: Response): Promise<void> {
  try {
    const {
      credentialTypes, // Array of credential types to request (e.g., ['LicenseCredential', 'BoardCertificationCredential'])
      workflow, // Verifier workflow (e.g., 'full_onboarding', 'hospitalist_onboarding')
      presentationDefinitionId, // Optional: ID of a saved presentation definition
      orgId, // Optional: Organization ID
      clientId, // Optional: OIDC client ID
    } = req.body;

    // Validate input
    if (!credentialTypes && !workflow && !presentationDefinitionId) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Either credentialTypes, workflow, or presentationDefinitionId must be provided',
      });
      return;
    }

    // Generate nonce and state for session
    const nonce = generateNonce();
    const state = generateState();

    let presentationDefinitionJson: Record<string, any>;

    // Option 1: Use saved presentation definition
    if (presentationDefinitionId) {
      const savedDef = await PresentationDefinitionService.getById(presentationDefinitionId);
      if (!savedDef) {
        res.status(404).json({
          error: 'not_found',
          error_description: 'Presentation definition not found',
        });
        return;
      }
      presentationDefinitionJson = savedDef.json as Record<string, any>;
    }
    // Option 2: Generate from workflow policy
    else if (workflow) {
      const policy = getPolicy(workflow as VerifierWorkflow);
      if (!policy) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: `Unknown workflow: ${workflow}`,
        });
        return;
      }
      presentationDefinitionJson = generatePresentationDefinition(workflow as VerifierWorkflow, {
        nonce,
        state,
        clientId,
      });
    }
    // Option 3: Generate from credential types (basic)
    else if (credentialTypes && Array.isArray(credentialTypes)) {
      // Simple presentation definition based on credential types
      presentationDefinitionJson = {
        id: `pd_${Date.now()}`,
        input_descriptors: credentialTypes.map((type: string, index: number) => ({
          id: `input_descriptor_${index + 1}`,
          name: `Requirement for ${type}`,
          purpose: `Verify ${type}`,
          format: {
            jwt_vc: {
              alg: ['EdDSA', 'ES256'],
            },
            jwt_vc_json: {
              alg: ['EdDSA', 'ES256'],
            },
          },
        })),
        format: {
          jwt_vc: {
            alg: ['EdDSA', 'ES256'],
          },
          jwt_vc_json: {
            alg: ['EdDSA', 'ES256'],
          },
        },
        nonce,
        state,
      };
    } else {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid input: credentialTypes must be an array',
      });
      return;
    }

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + SESSION_TTL_MINUTES);

    // Create verifier session (DC-004)
    const session = await prisma.verifierSession.create({
      data: {
        orgId: orgId || null,
        nonce,
        state,
        presentationDefinitionId: presentationDefinitionId || null,
        expiresAt,
        status: 'pending',
      },
    });

    // Build OIDC request URL
    const redirectUri = `${VERIFIER_BASE_URL}/api/oid4vp/callback`;
    const requestUri = `${VERIFIER_BASE_URL}/api/oid4vp/request/${session.id}`;

    // OIDC authorization request parameters
    const oidcParams = new URLSearchParams({
      client_id: clientId || 'vitalcv-verifier',
      response_type: 'vp_token',
      response_mode: 'direct_post',
      redirect_uri: redirectUri,
      scope: 'openid',
      nonce,
      state,
      request_uri: requestUri,
      presentation_definition: JSON.stringify(presentationDefinitionJson),
    });

    const requestUrl = `openid-credential-offer://?${oidcParams.toString()}`;
    const qrPayload = JSON.stringify({
      type: 'oid4vp_request',
      url: requestUrl,
      nonce,
      state,
      sessionId: session.id,
    });

    // Log audit event
    await auditLog((req as any).user?.id || 'system', 'OID4VP_REQUEST_CREATED', {
      sessionId: session.id,
      orgId: orgId || null,
      workflow: workflow || null,
      presentationDefinitionId: presentationDefinitionId || null,
    });

    res.json({
      sessionId: session.id,
      nonce,
      state,
      presentation_definition: presentationDefinitionJson,
      request_url: requestUrl,
      qr_payload: qrPayload,
      expires_at: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('[OID4VP Request] Error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

/**
 * GET /api/oid4vp/request/:sessionId
 *
 * Retrieve presentation request by session ID
 */
export async function getPresentationRequest(req: Request, res: Response): Promise<void> {
  try {
    const { sessionId } = req.params;

    const session = await prisma.verifierSession.findUnique({
      where: { id: sessionId },
      include: {
        presentationDefinition: true,
      },
    });

    if (!session) {
      res.status(404).json({
        error: 'not_found',
        error_description: 'Session not found',
      });
      return;
    }

    // Check if session is expired
    if (new Date() > session.expiresAt && session.status === 'pending') {
      await prisma.verifierSession.update({
        where: { id: sessionId },
        data: { status: 'expired' },
      });
      res.status(410).json({
        error: 'expired',
        error_description: 'Session has expired',
      });
      return;
    }

    let presentationDefinitionJson: Record<string, any>;
    if (session.presentationDefinition) {
      presentationDefinitionJson = session.presentationDefinition.json as Record<string, any>;
    } else {
      // Fallback: minimal definition
      presentationDefinitionJson = {
        id: `pd_${session.id}`,
        input_descriptors: [],
      };
    }

    res.json({
      sessionId: session.id,
      nonce: session.nonce,
      state: session.state,
      presentation_definition: presentationDefinitionJson,
      status: session.status,
      expires_at: session.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('[OID4VP Get Request] Error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

