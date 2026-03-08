/**
 * smartHealthCards.ts — Wave 154: SMART Health Cards Export
 *
 * Exports VitalCV credentials in SMART Health Card–compatible formats:
 *   - exportSmartHealthCardFile()      — .smart-health-card JSON file
 *   - exportSmartHealthDeepLink()      — shc:/ deep link for mobile wallets
 *   - exportSmartHealthQrPayload()     — QR-ready payload chunks
 *
 * These are handoff formats — we do NOT generate actual JWS SMART cards
 * (which require a SMART-registered issuer), but produce compatible
 * envelopes that downstream wallet apps can ingest.
 *
 * Feature flag: FEATURE_CHAPI_WALLET_EXPORT
 */

import { createHash, randomUUID } from 'node:crypto';
import { log } from '../../obs/logger';
import { appendAuditEvent, newTraceId } from '../audit/auditLedger';
import { getCredential, getCredentialsForSubject } from './credentialWallet';
import type { VerifiableCredential } from './credentialModel';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SmartHealthCardFile {
  /** SMART Health Card file structure */
  verifiableCredential: string[];
  /** VitalCV metadata envelope */
  meta: {
    issuer: string;
    subject: string;
    exportedAt: string;
    traceId: string;
    payloadHash: string;
    credentialCount: number;
  };
}

export interface SmartHealthDeepLink {
  /** shc:/ deep link URL */
  deepLink: string;
  /** Fallback web URL */
  webFallback: string;
  meta: {
    subject: string;
    exportedAt: string;
    traceId: string;
    payloadHash: string;
  };
}

export interface SmartHealthQrPayload {
  /** QR payload chunks (for large payloads, split into multiple QR codes) */
  chunks: string[];
  /** Total chunks */
  totalChunks: number;
  /** SHA-256 hash of the full payload */
  payloadHash: string;
  meta: {
    subject: string;
    exportedAt: string;
    traceId: string;
    credentialCount: number;
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
 * Create a minimized JWS-like payload string for SMART card compatibility.
 * This is NOT a real JWS — it's a base64url-encoded JSON envelope.
 */
function createSmartPayload(cred: VerifiableCredential): string {
  const payload = {
    iss: cred.issuer,
    nbf: Math.floor(new Date(cred.issuedAt).getTime() / 1000),
    vc: {
      type: ['https://smarthealth.cards#health-card', 'https://vitalcv.com/vc/healthcare-credential'],
      credentialSubject: {
        fhirVersion: '4.0.1',
        fhirBundle: {
          resourceType: 'Bundle',
          type: 'collection',
          entry: [
            {
              fullUrl: `resource:${cred.credentialId}`,
              resource: {
                resourceType: 'Practitioner',
                id: cred.subject,
                identifier: [{ system: 'http://hl7.org/fhir/sid/us-npi', value: cred.subject }],
                meta: { tag: [{ system: 'https://vitalcv.com', code: 'verified' }] },
              },
            },
          ],
        },
      },
    },
  };

  // Base64url encode (NOT actual JWS signing)
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', zip: 'DEF', kid: cred.issuer })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = cred.signature ? cred.signature.slice(0, 43) : 'placeholder_signature';

  return `${header}.${body}.${sig}`;
}

/**
 * Numeric-encode a JWS string for QR code transmission (SMART Health Card spec).
 */
function numericEncode(jws: string): string {
  return jws
    .split('')
    .map((c) => {
      const code = c.charCodeAt(0) - 45;
      return code.toString().padStart(2, '0');
    })
    .join('');
}

/** Max characters per QR chunk (SMART spec recommends ~1195 for QR version 22) */
const QR_CHUNK_SIZE = 1195;

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Export credentials as a .smart-health-card JSON file.
 */
export function exportSmartHealthCardFile(opts: {
  subject: string;
  credentialIds: string[];
}): SmartHealthCardFile {
  if (!featureEnabled()) throw new Error('FEATURE_CHAPI_WALLET_EXPORT is disabled');

  const traceId = newTraceId();
  const jwsStrings: string[] = [];

  for (const credId of opts.credentialIds) {
    const cred = getCredential(credId);
    if (!cred) {
      log('warn', 'shc_export_credential_not_found', { credentialId: credId });
      continue;
    }
    jwsStrings.push(createSmartPayload(cred));
  }

  const payloadHash = sha256(jwsStrings.join('|'));

  const file: SmartHealthCardFile = {
    verifiableCredential: jwsStrings,
    meta: {
      issuer: 'did:vitalcv:issuer',
      subject: opts.subject,
      exportedAt: new Date().toISOString(),
      traceId,
      payloadHash,
      credentialCount: jwsStrings.length,
    },
  };

  appendAuditEvent({
    category: 'BUNDLE_EXPORT',
    actor: opts.subject,
    resource: `shc-file:${payloadHash.slice(0, 12)}`,
    requestFields: { subject: opts.subject, exportType: 'smart_health_card_file', credentialCount: jwsStrings.length },
    resultFields: { traceId, payloadHash },
    traceId,
  });

  log('info', 'shc_file_exported', { traceId, subject: opts.subject, credentials: jwsStrings.length });

  return file;
}

/**
 * Export credentials as a shc:/ deep link for mobile wallet apps.
 */
export function exportSmartHealthDeepLink(opts: {
  subject: string;
  credentialIds: string[];
  webFallbackBase?: string;
}): SmartHealthDeepLink {
  if (!featureEnabled()) throw new Error('FEATURE_CHAPI_WALLET_EXPORT is disabled');

  const traceId = newTraceId();
  const credentials: string[] = [];

  for (const credId of opts.credentialIds) {
    const cred = getCredential(credId);
    if (!cred) continue;
    credentials.push(createSmartPayload(cred));
  }

  // Numeric-encode the first credential for the deep link
  const primary = credentials[0] ?? '';
  const numericPayload = numericEncode(primary);
  const deepLink = `shc:/${numericPayload}`;

  const payloadHash = sha256(credentials.join('|'));
  const webBase = opts.webFallbackBase ?? 'https://vitalcv.com';
  const webFallback = `${webBase}/p/${opts.subject}?export=shc&trace=${traceId}`;

  appendAuditEvent({
    category: 'BUNDLE_EXPORT',
    actor: opts.subject,
    resource: `shc-deeplink:${payloadHash.slice(0, 12)}`,
    requestFields: { subject: opts.subject, exportType: 'smart_health_card_deeplink', credentialCount: credentials.length },
    resultFields: { traceId, payloadHash },
    traceId,
  });

  log('info', 'shc_deeplink_exported', { traceId, subject: opts.subject });

  return {
    deepLink,
    webFallback,
    meta: {
      subject: opts.subject,
      exportedAt: new Date().toISOString(),
      traceId,
      payloadHash,
    },
  };
}

/**
 * Export credentials as QR-ready numeric chunks (SMART Health Card spec).
 */
export function exportSmartHealthQrPayload(opts: {
  subject: string;
  credentialIds: string[];
}): SmartHealthQrPayload {
  if (!featureEnabled()) throw new Error('FEATURE_CHAPI_WALLET_EXPORT is disabled');

  const traceId = newTraceId();
  const credentials: string[] = [];

  for (const credId of opts.credentialIds) {
    const cred = getCredential(credId);
    if (!cred) continue;
    credentials.push(createSmartPayload(cred));
  }

  const fullPayload = credentials.map((c) => numericEncode(c)).join('');
  const payloadHash = sha256(fullPayload);

  // Split into QR-safe chunks
  const chunks: string[] = [];
  const totalChunks = Math.ceil(fullPayload.length / QR_CHUNK_SIZE);
  for (let i = 0; i < totalChunks; i++) {
    const chunk = fullPayload.slice(i * QR_CHUNK_SIZE, (i + 1) * QR_CHUNK_SIZE);
    // SMART SHC chunk format: shc:/[chunkIndex]/[totalChunks]/[numericPayload]
    chunks.push(`shc:/${i + 1}/${totalChunks}/${chunk}`);
  }

  appendAuditEvent({
    category: 'BUNDLE_EXPORT',
    actor: opts.subject,
    resource: `shc-qr:${payloadHash.slice(0, 12)}`,
    requestFields: { subject: opts.subject, exportType: 'smart_health_card_qr_payload', credentialCount: credentials.length },
    resultFields: { traceId, payloadHash, totalChunks: chunks.length },
    traceId,
  });

  log('info', 'shc_qr_exported', { traceId, subject: opts.subject, chunks: chunks.length });

  return {
    chunks,
    totalChunks: chunks.length,
    payloadHash,
    meta: {
      subject: opts.subject,
      exportedAt: new Date().toISOString(),
      traceId,
      credentialCount: credentials.length,
    },
  };
}
