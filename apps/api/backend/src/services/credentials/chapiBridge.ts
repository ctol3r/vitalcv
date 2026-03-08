/**
 * chapiBridge.ts — Wave 154: CHAPI-Style Wallet Interoperability Bridge
 *
 * Implements Credential Handler API (CHAPI)–style payloads for
 * browser/mobile wallet interoperability:
 *   - createPresentationRequest()  — VerifiablePresentation Request envelope
 *   - createStorePayload()         — wallet.store() payload
 *   - normalizeWalletExport()      — normalize a VC for wallet ingestion
 *
 * Feature flag: FEATURE_CHAPI_WALLET_EXPORT
 */

import { randomUUID, createHash } from 'node:crypto';
import { log } from '../../obs/logger';
import { appendAuditEvent, newTraceId } from '../audit/auditLedger';
import { getCredential, getCredentialsForSubject } from './credentialWallet';
import type { VerifiableCredential } from './credentialModel';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ChapiPresentationRequest {
  type: 'VerifiablePresentationRequest';
  query: Array<{
    type: 'QueryByExample';
    credentialQuery: {
      reason: string;
      example: {
        '@context': string[];
        type: string[];
      };
    };
  }>;
  challenge: string;
  domain: string;
  interact: {
    service: Array<{
      type: 'VerifiablePresentation';
      serviceEndpoint: string;
    }>;
  };
  meta: {
    generatedAt: string;
    traceId: string;
  };
}

export interface ChapiStorePayload {
  type: 'VerifiablePresentation';
  holder: string;
  verifiableCredential: NormalizedWalletCredential[];
  proof: {
    type: 'Ed25519Signature2020';
    created: string;
    challenge: string;
    domain: string;
    proofPurpose: 'authentication';
  };
  meta: {
    generatedAt: string;
    traceId: string;
    payloadHash: string;
  };
}

export interface NormalizedWalletCredential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: {
    id: string;
    [key: string]: unknown;
  };
  proof: {
    type: string;
    jws: string;
    created: string;
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function featureEnabled(): boolean {
  return process.env.FEATURE_CHAPI_WALLET_EXPORT !== 'false';
}

/**
 * Normalize a VitalCV VerifiableCredential into W3C VC-compatible format
 * for wallet ingestion.
 */
export function normalizeWalletExport(cred: VerifiableCredential): NormalizedWalletCredential {
  return {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://vitalcv.com/contexts/healthcare/v1',
    ],
    id: `urn:uuid:${cred.credentialId}`,
    type: ['VerifiableCredential', 'HealthcareCredential'],
    issuer: cred.issuer,
    issuanceDate: cred.issuedAt,
    ...(cred.expiresAt ? { expirationDate: cred.expiresAt } : {}),
    credentialSubject: {
      id: `did:npi:${cred.subject}`,
      ...cred.claims,
    },
    proof: {
      type: 'JsonWebSignature2020',
      jws: cred.signature,
      created: cred.issuedAt,
    },
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Create a CHAPI-style VerifiablePresentation Request for wallet interaction.
 */
export function createPresentationRequest(opts: {
  reason: string;
  credentialTypes?: string[];
  domain?: string;
  serviceEndpoint?: string;
}): ChapiPresentationRequest {
  const traceId = newTraceId();
  const challenge = randomUUID();

  const request: ChapiPresentationRequest = {
    type: 'VerifiablePresentationRequest',
    query: [
      {
        type: 'QueryByExample',
        credentialQuery: {
          reason: opts.reason,
          example: {
            '@context': ['https://www.w3.org/2018/credentials/v1'],
            type: opts.credentialTypes ?? ['VerifiableCredential', 'HealthcareCredential'],
          },
        },
      },
    ],
    challenge,
    domain: opts.domain ?? 'vitalcv.com',
    interact: {
      service: [
        {
          type: 'VerifiablePresentation',
          serviceEndpoint: opts.serviceEndpoint ?? '/api/credentials/present',
        },
      ],
    },
    meta: {
      generatedAt: new Date().toISOString(),
      traceId,
    },
  };

  appendAuditEvent({
    category: 'PRESENTATION',
    actor: 'system',
    resource: `chapi-vpr:${challenge}`,
    requestFields: { reason: opts.reason, domain: opts.domain },
    resultFields: { traceId, challenge },
    traceId,
  });

  log('info', 'chapi_presentation_request_created', { traceId, challenge });

  return request;
}

/**
 * Create a CHAPI-style store payload (VerifiablePresentation) for wallet.store().
 */
export function createStorePayload(opts: {
  subject: string;
  credentialIds: string[];
  domain?: string;
}): ChapiStorePayload {
  if (!featureEnabled()) {
    throw new Error('FEATURE_CHAPI_WALLET_EXPORT is disabled');
  }

  const traceId = newTraceId();
  const challenge = randomUUID();
  const credentials: NormalizedWalletCredential[] = [];

  for (const credId of opts.credentialIds) {
    const cred = getCredential(credId);
    if (!cred) {
      log('warn', 'chapi_store_credential_not_found', { credentialId: credId });
      continue;
    }
    credentials.push(normalizeWalletExport(cred));
  }

  const payloadHash = sha256(JSON.stringify(credentials.map((c) => c.id)));

  const payload: ChapiStorePayload = {
    type: 'VerifiablePresentation',
    holder: `did:npi:${opts.subject}`,
    verifiableCredential: credentials,
    proof: {
      type: 'Ed25519Signature2020',
      created: new Date().toISOString(),
      challenge,
      domain: opts.domain ?? 'vitalcv.com',
      proofPurpose: 'authentication',
    },
    meta: {
      generatedAt: new Date().toISOString(),
      traceId,
      payloadHash,
    },
  };

  appendAuditEvent({
    category: 'BUNDLE_EXPORT',
    actor: opts.subject,
    resource: `chapi-store:${payloadHash.slice(0, 12)}`,
    requestFields: {
      subject: opts.subject,
      credentialCount: credentials.length,
      exportType: 'chapi_store_payload',
    },
    resultFields: { traceId, payloadHash, credentialCount: credentials.length },
    traceId,
  });

  log('info', 'chapi_store_payload_created', {
    traceId,
    subject: opts.subject,
    credentials: credentials.length,
    payloadHash: payloadHash.slice(0, 12),
  });

  return payload;
}
