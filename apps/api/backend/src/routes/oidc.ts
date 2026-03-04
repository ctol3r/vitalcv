/**
 * oidc.ts — Wave 49: OIDC4VP Presentation Gateway
 *
 * OpenID for Verifiable Presentations (OIDC4VP 1.0) endpoints.
 * Allows external verifiers to request cryptographic proofs from VitalCV wallets.
 *
 * Flow:
 * 1. Verifier calls GET /api/oidc/authorize with scope + redirect_uri
 * 2. Gateway creates a PresentationRequest and returns requestId + presentationDefinition
 * 3. Wallet receives the request (via QR code or deep link)
 * 4. Wallet submits vp_token via POST /api/oidc/presentation
 * 5. Gateway verifies SD-JWT, writes AuditEvent, returns claims
 * 6. Verifier polls GET /api/oidc/status/:requestId for completion
 */

import type { Express, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import { sha256Hex } from '../utils/deterministic';
import { sdJwtService } from '../services/crypto/sdJwt';
import type { DisclosedClaim } from '../services/crypto/sdJwt';

// ── Types ──────────────────────────────────────────────────

interface FieldConstraint {
  path: string[];
  filter?: { type: string; pattern?: string };
}

interface InputDescriptor {
  id: string;
  name: string;
  purpose: string;
  constraints: { fields: FieldConstraint[] };
}

interface PresentationDefinition {
  id: string;
  inputDescriptors: InputDescriptor[];
}

type RequestStatus = 'PENDING' | 'COMPLETED' | 'EXPIRED';

interface PresentationRequest {
  requestId: string;
  responseType: 'vp_token';
  presentationDefinition: PresentationDefinition;
  nonce: string;
  state: string;
  clientId: string;
  redirectUri: string;
  createdAt: number;
  status: RequestStatus;
  claims: DisclosedClaim[] | null;
}

interface PresentationSubmission {
  id: string;
  definitionId: string;
  descriptorMap: DescriptorMapEntry[];
}

interface DescriptorMapEntry {
  id: string;
  format: string;
  path: string;
}

// ── In-memory store with TTL ───────────────────────────────

const REQUEST_TTL_MS = 5 * 60 * 1000; // 5 minutes
const requestStore = new Map<string, PresentationRequest>();

/**
 * Evict expired requests from the store.
 * Called on each request to keep memory bounded.
 */
function evictExpired(): void {
  const now = Date.now();
  for (const [id, req] of requestStore) {
    if (now - req.createdAt > REQUEST_TTL_MS) {
      req.status = 'EXPIRED';
      requestStore.delete(id);
    }
  }
}

// ── Scope → InputDescriptor mapping ────────────────────────

const SCOPE_DESCRIPTORS: Record<string, InputDescriptor> = {
  'credential:medical_license': {
    id: 'medical_license',
    name: 'Medical License',
    purpose: 'Verify active medical license for clinical privileges',
    constraints: {
      fields: [
        { path: ['$.type'], filter: { type: 'string', pattern: 'MedicalLicense' } },
        { path: ['$.credentialSubject.licenseNumber'] },
        { path: ['$.credentialSubject.state'] },
        { path: ['$.credentialSubject.status'], filter: { type: 'string', pattern: 'ACTIVE' } },
      ],
    },
  },
  'credential:board_certification': {
    id: 'board_certification',
    name: 'Board Certification',
    purpose: 'Verify board certification status',
    constraints: {
      fields: [
        { path: ['$.type'], filter: { type: 'string', pattern: 'BoardCertification' } },
        { path: ['$.credentialSubject.specialty'] },
        { path: ['$.credentialSubject.certifyingBoard'] },
      ],
    },
  },
  'credential:dea_registration': {
    id: 'dea_registration',
    name: 'DEA Registration',
    purpose: 'Verify DEA controlled substance registration',
    constraints: {
      fields: [
        { path: ['$.type'], filter: { type: 'string', pattern: 'DEARegistration' } },
        { path: ['$.credentialSubject.deaNumber'] },
        { path: ['$.credentialSubject.schedules'] },
      ],
    },
  },
  'credential:npi': {
    id: 'npi_enrollment',
    name: 'NPI Enrollment',
    purpose: 'Verify NPI enrollment status',
    constraints: {
      fields: [
        { path: ['$.type'], filter: { type: 'string', pattern: 'NPIEnrollment' } },
        { path: ['$.credentialSubject.npi'] },
      ],
    },
  },
};

/**
 * Default fallback descriptor for unknown scopes.
 */
function fallbackDescriptor(scope: string): InputDescriptor {
  return {
    id: scope.replace(/[^a-zA-Z0-9_]/g, '_'),
    name: scope,
    purpose: `Verify ${scope}`,
    constraints: {
      fields: [{ path: ['$.type'] }],
    },
  };
}

// ── Route registration ─────────────────────────────────────

export function registerOidcRoutes(app: Express): void {
  /**
   * GET /api/oidc/authorize
   *
   * Initiates an OIDC4VP authorization request.
   * The verifier provides scope(s) describing which credentials they need.
   * Returns a requestId and presentationDefinition for the wallet.
   */
  app.get('/api/oidc/authorize', (req: Request, res: Response) => {
    evictExpired();

    const clientId = req.query.client_id as string | undefined;
    const redirectUri = req.query.redirect_uri as string | undefined;
    const scope = req.query.scope as string | undefined;
    const nonce = req.query.nonce as string | undefined;
    const state = req.query.state as string | undefined;

    if (!clientId || !redirectUri || !scope || !nonce) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing required parameters: client_id, redirect_uri, scope, nonce',
      });
    }

    // Parse scopes (comma-separated or space-separated)
    const scopes = scope.split(/[,\s]+/).filter((s) => s.length > 0);
    const inputDescriptors = scopes.map(
      (s) => SCOPE_DESCRIPTORS[s] ?? fallbackDescriptor(s),
    );

    const requestId = sha256Hex(`${clientId}:${nonce}:${Date.now()}`).slice(0, 32);

    const presentationDefinition: PresentationDefinition = {
      id: `pd-${requestId}`,
      inputDescriptors,
    };

    const request: PresentationRequest = {
      requestId,
      responseType: 'vp_token',
      presentationDefinition,
      nonce,
      state: state ?? '',
      clientId,
      redirectUri,
      createdAt: Date.now(),
      status: 'PENDING',
      claims: null,
    };

    requestStore.set(requestId, request);

    log('info', 'OIDC4VP authorization request created', {
      requestId,
      clientId,
      scopes,
    });

    return res.json({
      requestId,
      responseType: 'vp_token',
      presentationDefinition,
      nonce,
      state: state ?? '',
    });
  });

  /**
   * POST /api/oidc/presentation
   *
   * Receives a vp_token from the wallet containing SD-JWT credential(s).
   * Validates the request exists, verifies the SD-JWT, writes an AuditEvent,
   * and returns the verification result.
   */
  app.post('/api/oidc/presentation', async (req: Request, res: Response) => {
    evictExpired();

    const { requestId, vpToken, presentationSubmission } = req.body as {
      requestId?: string;
      vpToken?: string;
      presentationSubmission?: PresentationSubmission;
    };

    if (!requestId || !vpToken) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing required fields: requestId, vpToken',
      });
    }

    const request = requestStore.get(requestId);
    if (!request) {
      return res.status(404).json({
        error: 'request_not_found',
        error_description: 'Presentation request not found or expired',
      });
    }

    if (request.status !== 'PENDING') {
      return res.status(409).json({
        error: 'request_already_completed',
        error_description: `Request is already ${request.status}`,
      });
    }

    try {
      // Verify the SD-JWT token
      const result = await sdJwtService.verifySdJwt(vpToken);

      // Update request state
      request.status = 'COMPLETED';
      request.claims = result.disclosedClaims;

      // Write AuditEvent for the presentation verification
      const eventHash = sha256Hex(
        JSON.stringify({
          type: 'OIDC4VP_PRESENTATION',
          requestId,
          issuer: result.issuer,
          subject: result.subject,
          valid: result.valid,
          verifiedAt: result.verifiedAt,
        }),
      );

      await prisma.auditEvent.create({
        data: {
          type: 'OIDC4VP_PRESENTATION',
          hash: eventHash,
          referenceId: requestId,
          metadata: JSON.parse(JSON.stringify({
            clientId: request.clientId,
            issuer: result.issuer,
            subject: result.subject,
            valid: result.valid,
            claimCount: result.disclosedClaims.length,
            revoked: result.revoked,
            presentationSubmissionId: presentationSubmission?.id ?? null,
          })),
        },
      });

      log('info', 'OIDC4VP presentation verified', {
        requestId,
        valid: result.valid,
        claimCount: result.disclosedClaims.length,
      });

      return res.json({
        verified: result.valid,
        claims: result.disclosedClaims,
        issuer: result.issuer,
        subject: result.subject,
        expiresAt: result.expiresAt,
        verifiedAt: result.verifiedAt,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown verification error';

      log('error', 'OIDC4VP presentation verification failed', {
        requestId,
        error: message,
      });

      return res.status(422).json({
        error: 'verification_failed',
        error_description: message,
        verified: false,
      });
    }
  });

  /**
   * GET /api/oidc/status/:requestId
   *
   * Polling endpoint for verifier UI.
   * Returns the current status of a presentation request.
   */
  app.get('/api/oidc/status/:requestId', (req: Request, res: Response) => {
    evictExpired();

    const { requestId } = req.params;
    const request = requestStore.get(requestId);

    if (!request) {
      return res.json({
        requestId,
        status: 'EXPIRED' as const,
        claims: null,
      });
    }

    // Check if the request has expired by TTL
    if (Date.now() - request.createdAt > REQUEST_TTL_MS) {
      request.status = 'EXPIRED';
      requestStore.delete(requestId);
    }

    return res.json({
      requestId,
      status: request.status,
      claims: request.status === 'COMPLETED' ? request.claims : null,
    });
  });

  log('info', 'OIDC4VP presentation gateway routes registered');
}
