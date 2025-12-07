import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { VPValidator } from '../../../../../src/services/presentation/validator';
import { verifyDpopProof } from '../../services/security/dpop';
import { presentationSessionStore } from '../../services/oidc4vp/store';
import { statusListService, type CredentialStatusRecord } from '../../services/status/statusList';
import { anchorVerificationEvent } from '../../services/verification/anchor';

const router = Router();
const validator = new VPValidator();

router.post('/', async (req: Request, res: Response) => {
  const { vp_token: vpToken, presentation_submission: presentationSubmission, state } = req.body ?? {};

  if (!vpToken || !state) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'vp_token and state are required',
    });
  }

  const session = presentationSessionStore.getSessionByState(state);
  if (!session) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'presentation session expired or unknown',
    });
  }

  const dpopHeader = req.header('dpop') ?? req.header('DPoP');
  if (!dpopHeader) {
    return res.status(401).json({
      error: 'use_dpop',
      error_description: 'DPoP proof required for presentations',
    });
  }

  try {
    const requestUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    await verifyDpopProof({
      proof: dpopHeader,
      method: req.method,
      url: requestUrl,
    });
  } catch (error) {
    const description = error instanceof Error ? error.message : 'DPoP verification failed';
    return res.status(401).json({
      error: 'invalid_dpop',
      error_description: description,
    });
  }

  const validation = await validatePresentationToken(vpToken, session);
  if (!validation.valid) {
    presentationSessionStore.updateSession(session.nonce, {
      status: 'failed',
      verificationResult: { error: validation.error },
    });
    return res.status(400).json({
      error: 'invalid_presentation',
      error_description: validation.error ?? 'Presentation validation failed',
    });
  }

  const credentialSummaries = extractCredentialSummaries(validation.payload);
  if (credentialSummaries.length === 0) {
    presentationSessionStore.updateSession(session.nonce, {
      status: 'failed',
      verificationResult: { error: 'No credentials disclosed' },
    });
    return res.status(400).json({
      error: 'invalid_presentation',
      error_description: 'No verifiable credentials found in presentation',
    });
  }

  const statusChecks = credentialSummaries.map((summary) =>
    statusListService.getStatus(summary.id ?? summary.hash ?? summary.jwt ?? 'unknown'),
  );
  const chainStatus = deriveChainStatus(statusChecks);

  if (chainStatus === 'revoked') {
    presentationSessionStore.updateSession(session.nonce, {
      status: 'failed',
      verificationResult: { error: 'Credential revoked' },
    });
    return res.status(400).json({
      error: 'revoked_credential',
      error_description: 'Credential is marked as revoked on the status list',
    });
  }

  const anchored = anchorVerificationEvent({
    credentialIds: credentialSummaries.map((summary) => summary.id ?? summary.hash ?? randomUUID()),
    status: 'valid',
    nonce: session.nonce,
    metadata: {
      presentation_submission: presentationSubmission,
      schema: session.expectedSchema,
    },
  });

  presentationSessionStore.updateSession(session.nonce, {
    status: 'verified',
    verificationResult: {
      anchoredEventId: anchored.id,
      payload: validation.payload,
      statusChecks,
    },
  });

  const claimsShown = credentialSummaries.map((summary, index) => ({
    credentialId: summary.id ?? summary.hash,
    issuer: summary.issuer,
    subject: summary.subject,
    type: summary.type,
    fields: summary.fields,
    status: statusChecks[index]?.status ?? 'unknown',
  }));

  return res.json({
    valid: true,
    claimsShown,
    issuer: claimsShown[0]?.issuer,
    chainStatus,
  });
});

export default router;

async function validatePresentationToken(
  vpToken: string,
  session: { nonce: string; expectedSchema?: string },
): Promise<{ valid: boolean; payload?: any; error?: string }> {
  if (isSdJwtPresentation(vpToken)) {
    return validateSdJwtPresentation(vpToken, session.nonce);
  }
  return validator.validate(
    vpToken,
    session.nonce,
    session.expectedSchema,
  );
}

function isSdJwtPresentation(token: string): boolean {
  return token.includes('~');
}

async function validateSdJwtPresentation(token: string, expectedNonce: string) {
  try {
    const [jwt, ...disclosures] = token.split('~');
    const payload = decodeJwtPayload(jwt);
    if (!payload) {
      return { valid: false, error: 'Unable to decode SD-JWT payload' };
    }
    if (payload.nonce && payload.nonce !== expectedNonce) {
      return { valid: false, error: 'Nonce mismatch' };
    }
    return {
      valid: true,
      payload: {
        vp: {
          verifiableCredential: [
            {
              id: payload.jti,
              issuer: payload.iss,
              type: payload.vc?.type ?? ['VerifiableCredential'],
              credentialSubject: payload.vc?.credentialSubject,
              disclosures,
            },
          ],
        },
      },
    };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'SD-JWT validation failed' };
  }
}

function extractCredentialSummaries(payload: any) {
  const credentials = payload?.vp?.verifiableCredential;
  const list = Array.isArray(credentials) ? credentials : credentials ? [credentials] : [];
  return list
    .filter(Boolean)
    .map((credential) => normalizeCredentialSummary(credential));
}

function normalizeCredentialSummary(credential: any) {
  if (typeof credential === 'string') {
    const payload = decodeJwtPayload(credential);
    return {
      id: payload?.jti,
      issuer: payload?.iss,
      subject: payload?.sub ?? payload?.vc?.credentialSubject?.id,
      type: payload?.vc?.type ?? payload?.type,
      fields: payload?.vc?.credentialSubject ? Object.keys(payload.vc.credentialSubject).filter((key) => key !== 'id') : [],
      hash: payload?.vc?.credential_hash,
      jwt: credential,
    };
  }

  return {
    id: credential.id,
    issuer: credential.issuer?.id ?? credential.issuer,
    subject: credential.credentialSubject?.id,
    type: credential.type,
    fields: credential.credentialSubject
      ? Object.keys(credential.credentialSubject).filter((key) => key !== 'id')
      : [],
    hash: credential.credential_hash ?? credential.hash,
  };
}

function decodeJwtPayload(token: string): Record<string, any> | undefined {
  const parts = token.split('.');
  if (parts.length < 2) {
    return undefined;
  }
  try {
    const json = decodeBase64Url(parts[1]).toString('utf-8');
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

function decodeBase64Url(segment: string): Buffer {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64');
}

function deriveChainStatus(statuses: CredentialStatusRecord[]): string {
  if (statuses.some((status) => status.status === 'revoked')) {
    return 'revoked';
  }
  if (statuses.some((status) => status.status === 'suspended')) {
    return 'review';
  }
  if (statuses.some((status) => status.status === 'unknown')) {
    return 'unknown';
  }
  return 'valid';
}


