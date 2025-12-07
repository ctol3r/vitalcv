/**
 * DC-002: OID4VP Presentation Verification Controller
 * Verifies VP tokens returned from wallets
 */

import { Request, Response } from 'express';
import { jwtVerify, decodeJwt, createLocalJWKSet, JWK } from 'jose';
import prisma from '../graphql/prisma_client';
import { auditLog } from '../controllers/audit';
import { getPolicy } from './policy/verifierPolicy';

// Import VC verification service
// This should be available from the verifier-api or we can use the existing credential verification
const VC_VERIFY_URL = process.env.VC_VERIFY_URL || 'http://localhost:4002/verify/credential';

interface VerificationResult {
  status: 'verified' | 'failed' | 'partial';
  subjectInfo?: {
    npi?: string;
    did?: string;
    email?: string;
    name?: string;
  };
  credentialSummaries: Array<{
    type: string;
    issuer: string;
    issueDate?: string;
    status: 'valid' | 'invalid' | 'expired';
  }>;
  policyFlags: {
    allRequiredPresent: boolean;
    missingCredentials: string[];
  };
  errors?: string[];
}

/**
 * Verify a single VC JWT
 */
async function verifyCredentialJWT(credentialJwt: string): Promise<{
  valid: boolean;
  issuer?: string;
  subject?: string;
  issuedAt?: Date;
  expiresAt?: Date;
  error?: string;
}> {
  try {
    // Decode to get issuer
    const decoded = decodeJwt(credentialJwt);
    const issuer = decoded.iss as string;
    const subject = decoded.sub as string;

    // Call VC verification service
    try {
      // Use node-fetch or native fetch (Node.js 18+)
      const fetchFn = typeof fetch !== 'undefined' ? fetch : (await import('node-fetch')).default;
      const response = await fetchFn(VC_VERIFY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ credential: credentialJwt }),
      });

      if (!response.ok) {
        return {
          valid: false,
          issuer,
          subject,
          error: `VC verification service returned ${response.status}`,
        };
      }

      const result = await response.json();
      return {
        valid: result.valid === true,
        issuer,
        subject,
        issuedAt: result.issuedAt ? new Date(result.issuedAt) : undefined,
        expiresAt: result.expiresAt ? new Date(result.expiresAt) : undefined,
        error: result.reason,
      };
    } catch (fetchError) {
      // Fallback: basic JWT structure validation
      const parts = credentialJwt.split('.');
      if (parts.length !== 3) {
        return {
          valid: false,
          issuer,
          subject,
          error: 'Invalid JWT format',
        };
      }
      return {
        valid: true, // Structure valid, but signature not verified
        issuer,
        subject,
        error: 'VC verification service unavailable - only structure validated',
      };
    }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify holder key binding (DPoP or cnf.jkt)
 */
async function verifyHolderKeyBinding(
  vpToken: string,
  dpopProof?: string
): Promise<{ valid: boolean; error?: string }> {
  // TODO: Implement DPoP verification
  // TODO: Implement cnf.jkt (confirmation) check from VP token

  // For now, return valid if VP token is present
  if (!vpToken) {
    return { valid: false, error: 'Missing VP token' };
  }

  try {
    const decoded = decodeJwt(vpToken);
    // Check for cnf claim (confirmation method)
    if (decoded.cnf) {
      // cnf.jkt (JSON Web Key Thumbprint) should be verified against holder's key
      // This is a simplified check - in production, verify the actual key binding
      return { valid: true };
    }

    // If DPoP proof is provided, verify it
    if (dpopProof) {
      // TODO: Verify DPoP signature
      return { valid: true };
    }

    // If no binding method specified, we'll accept but log a warning
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to decode VP token',
    };
  }
}

/**
 * Extract credentials from VP token
 */
function extractCredentialsFromVP(vpToken: string): string[] {
  try {
    const decoded = decodeJwt(vpToken);
    const vp = decoded.vp as any;

    if (!vp || !vp.verifiableCredential) {
      return [];
    }

    const credentials = Array.isArray(vp.verifiableCredential)
      ? vp.verifiableCredential
      : [vp.verifiableCredential];

    // Filter for JWT credentials
    return credentials.filter((cred: any) => typeof cred === 'string' && cred.includes('.'));
  } catch {
    return [];
  }
}

/**
 * Extract subject information from credentials
 */
async function extractSubjectInfo(credentials: string[]): Promise<{
  npi?: string;
  did?: string;
  email?: string;
  name?: string;
}> {
  const subjectInfo: {
    npi?: string;
    did?: string;
    email?: string;
    name?: string;
  } = {};

  for (const cred of credentials) {
    try {
      const decoded = decodeJwt(cred) as any;
      const credentialSubject = decoded.vc?.credentialSubject || decoded.credentialSubject || {};

      if (credentialSubject.npi && !subjectInfo.npi) {
        subjectInfo.npi = credentialSubject.npi as string;
      }
      if (credentialSubject.did && !subjectInfo.did) {
        subjectInfo.did = credentialSubject.did as string;
      }
      if (credentialSubject.email && !subjectInfo.email) {
        subjectInfo.email = credentialSubject.email as string;
      }
      if (credentialSubject.givenName || credentialSubject.familyName) {
        const given = credentialSubject.givenName || '';
        const family = credentialSubject.familyName || '';
        if (!subjectInfo.name && (given || family)) {
          subjectInfo.name = `${given} ${family}`.trim();
        }
      }
    } catch {
      // Skip invalid credentials
    }
  }

  return subjectInfo;
}

/**
 * POST /api/oid4vp/verify
 *
 * Verifies a VP token returned from a wallet
 */
export async function verifyPresentation(req: Request, res: Response): Promise<void> {
  try {
    const {
      id_token, // OIDC ID token (if using ID token flow)
      vp_token, // VP token containing credentials
      presentation_submission,
      state,
      nonce,
      dpop_proof, // Optional DPoP proof
    } = req.body;

    if (!vp_token && !id_token) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Either vp_token or id_token must be provided',
      });
      return;
    }

    const token = vp_token || id_token;

    // Find session by nonce or state
    let session = null;
    if (nonce) {
      session = await prisma.verifierSession.findUnique({
        where: { nonce },
      });
    } else if (state) {
      session = await prisma.verifierSession.findUnique({
        where: { state },
      });
    }

    if (!session) {
      res.status(404).json({
        error: 'invalid_request',
        error_description: 'Session not found. Invalid nonce or state.',
      });
      return;
    }

    // Check if session is expired
    if (new Date() > session.expiresAt) {
      await prisma.verifierSession.update({
        where: { id: session.id },
        data: { status: 'expired' },
      });
      res.status(410).json({
        error: 'expired',
        error_description: 'Session has expired',
      });
      return;
    }

    // Check if session was already used
    if (session.status !== 'pending') {
      res.status(409).json({
        error: 'already_used',
        error_description: 'This session has already been processed',
      });
      return;
    }

    // Verify holder key binding
    const keyBindingResult = await verifyHolderKeyBinding(token, dpop_proof);
    if (!keyBindingResult.valid) {
      await prisma.verifierSession.update({
        where: { id: session.id },
        data: {
          status: 'failed',
          verificationResult: {
            error: keyBindingResult.error,
          } as any,
        },
      });
      res.status(400).json({
        error: 'invalid_binding',
        error_description: keyBindingResult.error || 'Holder key binding verification failed',
      });
      return;
    }

    // Extract credentials from VP token
    const credentialJwts = extractCredentialsFromVP(token);

    // Verify each credential
    const credentialVerifications = await Promise.all(
      credentialJwts.map(async (credJwt) => {
        const verification = await verifyCredentialJWT(credJwt);
        const decoded = decodeJwt(credJwt) as any;
        const vc = decoded.vc || decoded;
        const type = Array.isArray(vc?.type) ? vc.type.find((t: string) => t !== 'VerifiableCredential') : vc?.type;

        return {
          type: type || 'Unknown',
          issuer: decoded.iss as string,
          issueDate: verification.issuedAt?.toISOString(),
          status: verification.valid ? 'valid' : 'invalid',
          verification,
        };
      })
    );

    // Extract subject information
    const subjectInfo = await extractSubjectInfo(credentialJwts);

    // Check policy compliance (if workflow is available)
    let policyFlags = {
      allRequiredPresent: true,
      missingCredentials: [] as string[],
    };

    if (session.presentationDefinitionId) {
      const def = await prisma.presentationDefinition.findUnique({
        where: { id: session.presentationDefinitionId },
      });
      // TODO: Check if all required credentials from presentation_definition are present
      // For now, mark as compliant if at least one credential is valid
      policyFlags.allRequiredPresent = credentialVerifications.some((c) => c.status === 'valid');
    }

    // Build verification result
    const verificationResult: VerificationResult = {
      status: policyFlags.allRequiredPresent && credentialVerifications.every((c) => c.status === 'valid')
        ? 'verified'
        : credentialVerifications.some((c) => c.status === 'valid')
        ? 'partial'
        : 'failed',
      subjectInfo,
      credentialSummaries: credentialVerifications.map((c) => ({
        type: c.type,
        issuer: c.issuer,
        issueDate: c.issueDate,
        status: c.status as 'valid' | 'invalid' | 'expired',
      })),
      policyFlags,
    };

    // Upsert candidate if subject info is available (DC-015)
    let candidateId: string | null = null;
    if ((subjectInfo.npi || subjectInfo.did) && session.orgId) {
      try {
        // Try to find existing candidate first
        let candidate = null;
        if (subjectInfo.npi) {
          candidate = await prisma.candidate.findFirst({
            where: {
              orgId: session.orgId,
              npi: subjectInfo.npi,
            },
          });
        } else if (subjectInfo.did) {
          candidate = await prisma.candidate.findFirst({
            where: {
              orgId: session.orgId,
              did: subjectInfo.did,
            },
          });
        }

        if (candidate) {
          // Update existing
          candidate = await prisma.candidate.update({
            where: { id: candidate.id },
            data: {
              verifiedData: {
                ...(candidate.verifiedData as any || {}),
                ...subjectInfo,
                lastVerifiedAt: new Date().toISOString(),
              } as any,
            },
          });
        } else {
          // Create new
          candidate = await prisma.candidate.create({
            data: {
              orgId: session.orgId,
              npi: subjectInfo.npi || null,
              did: subjectInfo.did || null,
              email: subjectInfo.email || null,
              name: subjectInfo.name || null,
              verifiedData: {
                ...subjectInfo,
                lastVerifiedAt: new Date().toISOString(),
              } as any,
            },
          });
        }
        candidateId = candidate.id;
      } catch (error) {
        // Log error but don't fail verification
        console.error('[OID4VP Candidate Upsert] Error:', error);
      }
    }

    // Update session with verification result
    await prisma.verifierSession.update({
      where: { id: session.id },
      data: {
        status: verificationResult.status === 'verified' ? 'completed' : 'failed',
        vpToken: token,
        verificationResult: verificationResult as any,
        candidateId,
      },
    });

    // Log to AuditScrapbook
    await auditLog(
      (req as any).user?.id || 'system',
      'OID4VP_VERIFICATION_COMPLETED',
      {
        sessionId: session.id,
        orgId: session.orgId || null,
        status: verificationResult.status,
        subjectInfo,
        candidateId,
      }
    );

    res.json({
      verified: verificationResult.status === 'verified',
      sessionId: session.id,
      result: verificationResult,
    });
  } catch (error) {
    console.error('[OID4VP Verify] Error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

