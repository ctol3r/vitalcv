/**
 * S72-D1-A-008: Simple Credential Verification Endpoint
 *
 * Accepts a VC JWS or JSON-LD VC and verifies its signature against issuer DID keys.
 * Returns {valid: true/false, reason} plus status + receipt details.
 */

import express, { Request, Response } from 'express';
import crypto from 'crypto';
import {
  jwtVerify,
  decodeJwt,
  decodeProtectedHeader,
  importJWK,
  compactVerify,
  JWK,
  KeyLike,
} from 'jose';
import { resolveCredentialStatus } from '../services/statusRegistry';
import { createVerificationReceipt, hashCredential } from '../services/verificationReceipts';

const router = express.Router();

const DID_RESOLVER_URL = process.env.DID_RESOLVER_URL || 'https://dev.uniresolver.io/1.0/identifiers';
const VERIFIER_DID = process.env.VERIFIER_DID || 'did:web:verifier.vitalcv.com';

interface DidVerificationMethod {
  id: string;
  type?: string;
  controller?: string;
  publicKeyJwk?: JWK;
}

async function resolveDidDocument(did: string): Promise<any> {
  const response = await fetch(`${DID_RESOLVER_URL.replace(/\/$/, '')}/${encodeURIComponent(did)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`DID resolution failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data?.didDocument || data;
}

function normalizeVerificationMethod(entry: any, didDocument: any): DidVerificationMethod | null {
  if (!entry) return null;
  if (typeof entry === 'string') {
    const resolved = (didDocument.verificationMethod || []).find((method: any) => method.id === entry);
    return resolved || null;
  }
  if (typeof entry === 'object') {
    return entry as DidVerificationMethod;
  }
  return null;
}

function getVerificationMethods(didDocument: any): DidVerificationMethod[] {
  const methods: DidVerificationMethod[] = [];
  const verificationMethod = didDocument?.verificationMethod || [];
  if (Array.isArray(verificationMethod)) {
    verificationMethod.forEach((method: any) => {
      const normalized = normalizeVerificationMethod(method, didDocument);
      if (normalized?.id) methods.push(normalized);
    });
  }

  const assertionMethods = didDocument?.assertionMethod || didDocument?.authentication || [];
  if (Array.isArray(assertionMethods)) {
    assertionMethods.forEach((method: any) => {
      const normalized = normalizeVerificationMethod(method, didDocument);
      if (normalized?.id) methods.push(normalized);
    });
  }

  return methods;
}

function selectVerificationMethod(
  methods: DidVerificationMethod[],
  kid?: string
): DidVerificationMethod | null {
  if (kid) {
    const match = methods.find((method) => method.id === kid || method.id.endsWith(`#${kid}`));
    if (match) return match;
  }
  return methods.find((method) => method.publicKeyJwk) || null;
}

async function resolveIssuerKey(did: string, kid?: string): Promise<KeyLike> {
  const didDocument = await resolveDidDocument(did);
  const methods = getVerificationMethods(didDocument);
  const selected = selectVerificationMethod(methods, kid);
  if (!selected?.publicKeyJwk) {
    throw new Error('No compatible publicKeyJwk found in DID document');
  }
  const alg = selected.publicKeyJwk.alg || 'ES256';
  return importJWK(selected.publicKeyJwk, alg);
}

function extractIssuer(vc: any): string | null {
  if (!vc) return null;
  if (typeof vc.iss === 'string') return vc.iss;
  if (typeof vc.issuer === 'string') return vc.issuer;
  if (vc.issuer?.id) return vc.issuer.id;
  return null;
}

function extractCredentialId(vc: any, decoded?: any): string | null {
  if (vc?.id) return vc.id;
  if (decoded?.jti) return decoded.jti;
  if (decoded?.vc?.id) return decoded.vc.id;
  return null;
}

function extractMatchScore(decoded: any): number | undefined {
  if (typeof decoded?.matchScore === 'number') return decoded.matchScore;
  if (typeof decoded?.vc?.matchScore === 'number') return decoded.vc.matchScore;
  if (typeof decoded?.matcha?.score === 'number') return decoded.matcha.score;
  return undefined;
}

/**
 * POST /verify/credential
 *
 * Verifies a verifiable credential JWS signature
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;

    if (!credential || (typeof credential !== 'string' && typeof credential !== 'object')) {
      return res.status(400).json({
        valid: false,
        reason: 'Missing or invalid credential parameter. Expected a JWS string or JSON-LD object.'
      });
    }

    let decoded: any = null;
    let issuer: string | null = null;
    let subject: string | undefined;
    let signatureValid = false;
    let vcObject: any = null;

    if (typeof credential === 'string') {
      const tokenParts = credential.split('.');
      if (tokenParts.length === 3) {
        try {
          decoded = decodeJwt(credential);
          issuer = extractIssuer(decoded);
          subject = decoded.sub;
        } catch (decodeError) {
          return res.json({
            valid: false,
            reason: `Invalid JWT format: ${decodeError instanceof Error ? decodeError.message : 'unknown error'}`
          });
        }
      } else if (tokenParts.length > 1) {
        return res.json({
          valid: false,
          reason: 'Invalid JWT format: expected 3 parts',
        });
      } else {
        try {
          vcObject = JSON.parse(credential);
          issuer = extractIssuer(vcObject);
        } catch (parseError) {
          return res.json({
            valid: false,
            reason: `Invalid JSON-LD credential: ${parseError instanceof Error ? parseError.message : 'unknown error'}`,
          });
        }
      }
    } else {
      vcObject = credential;
      issuer = extractIssuer(vcObject);
    }

    if (!issuer) {
      return res.json({
        valid: false,
        reason: 'Credential missing issuer DID'
      });
    }

    try {
      if (typeof credential === 'string' && credential.split('.').length === 3) {
        const header = decodeProtectedHeader(credential);
        const key = await resolveIssuerKey(issuer, header.kid);
        await jwtVerify(credential, key, { issuer });
        signatureValid = true;
        vcObject = decoded?.vc || decoded;
      } else {
        const proof = vcObject?.proof;
        if (!proof || (!proof.jwt && !proof.jws)) {
          return res.json({
            valid: false,
            reason: 'Credential missing proof.jwt or proof.jws for signature verification',
          });
        }

        const proofToken = proof.jwt || proof.jws;
        if (typeof proofToken !== 'string' || proofToken.split('.').length !== 3) {
          return res.json({
            valid: false,
            reason: 'Invalid proof token format',
          });
        }

        const header = decodeProtectedHeader(proofToken);
        const key = await resolveIssuerKey(issuer, header.kid);

        if (proof.jwt) {
          await jwtVerify(proofToken, key, { issuer });
        } else {
          await compactVerify(proofToken, key);
        }
        signatureValid = true;
      }
    } catch (verifyError) {
      return res.json({
        valid: false,
        reason: `Signature verification failed: ${verifyError instanceof Error ? verifyError.message : 'unknown error'}`,
        issuer,
      });
    }

    const credentialId = extractCredentialId(vcObject, decoded) || crypto.randomUUID();
    const statusResult = await resolveCredentialStatus(credentialId);

    const verificationValid = signatureValid && statusResult.status !== 'revoked';
    if (!verificationValid) {
      return res.json({
        valid: false,
        reason: statusResult.status === 'revoked' ? 'Credential revoked' : 'Signature invalid',
        issuer,
        subject,
        status: statusResult,
      });
    }

    const vcHash = hashCredential(
      typeof credential === 'string' ? credential : JSON.stringify(credential)
    );
    const matchScore = extractMatchScore(decoded || vcObject);
    const receipt = await createVerificationReceipt({
      credentialId,
      verifiedBy: VERIFIER_DID,
      vcHash,
      ...(matchScore !== undefined && { matchScore }),
    });

    return res.json({
      valid: true,
      reason: 'Signature verified and credential active',
      issuer,
      subject,
      credentialId,
      status: statusResult,
      receipt: {
        id: receipt.id,
        jwt: receipt.jwt,
        payload: receipt.payload,
      },
    });
  } catch (error) {
    console.error('[VerifyCredential] Error:', error);
    return res.status(500).json({
      valid: false,
      reason: `Server error: ${error instanceof Error ? error.message : 'unknown error'}`
    });
  }
});

/**
 * GET /verify/credential/health
 *
 * Health check for verification service
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'credential-verifier',
    timestamp: new Date().toISOString(),
  });
});

export default router;
