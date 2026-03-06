/**
 * credentialPresentation.ts — Wave 98: Verifiable Presentation
 *
 * Bundles one or more VerifiableCredentials into a signed
 * Verifiable Presentation (VP). Uses the same ES256 JWS
 * mechanism as individual credentials.
 */

import { randomUUID } from 'node:crypto';
import { importPKCS8, SignJWT } from 'jose';
import { log } from '../../obs/logger';
import type { VerifiableCredential } from './credentialModel';

// ── Types ─────────────────────────────────────────────────────────────

export interface VerifiablePresentation {
  /** Unique presentation ID */
  presentationId: string;
  /** DID or NPI of the holder presenting the credentials */
  holder: string;
  /** The bundled credentials */
  credentials: VerifiableCredential[];
  /** Selective disclosure: which claim keys to include (null = all) */
  disclosedClaims?: string[];
  /** JWS signature over the presentation payload */
  signature: string;
  /** ISO-8601 creation timestamp */
  createdAt: string;
  /** Optional expiry for the presentation token */
  expiresAt?: string;
}

export interface CreatePresentationRequest {
  /** Holder DID or NPI */
  holder: string;
  /** Credential IDs to include */
  credentialIds: string[];
  /** Optional selective disclosure */
  disclosedClaims?: string[];
  /** Optional expiry (ISO-8601 or JWT duration string like '1h') */
  expiresAt?: string;
}

// ── Presentation wallet ───────────────────────────────────────────────

const presentations = new Map<string, VerifiablePresentation>();

// ── Public API ────────────────────────────────────────────────────────

/**
 * Create a signed Verifiable Presentation from an array of credentials.
 *
 * @param credentials  - Array of credentials to bundle
 * @param holder       - DID or NPI of the presenting clinician
 * @param signingKeyPem - PKCS#8 PEM private key for ES256 signing
 * @param opts         - Optional expiry and selective disclosure
 */
export async function createPresentation(
  credentials: VerifiableCredential[],
  holder: string,
  signingKeyPem: string,
  opts: { expiresAt?: string; disclosedClaims?: string[] } = {},
): Promise<VerifiablePresentation> {
  if (credentials.length === 0) {
    throw new Error('Presentation must include at least one credential');
  }

  const presentationId = randomUUID();
  const now = new Date().toISOString();

  // Apply selective disclosure — filter claim keys per credential
  const disclosedCredentials = opts.disclosedClaims
    ? credentials.map((cred) => ({
        ...cred,
        claims: Object.fromEntries(
          Object.entries(cred.claims).filter(([key]) =>
            opts.disclosedClaims!.includes(key),
          ),
        ),
      }))
    : credentials;

  const privateKey = await importPKCS8(signingKeyPem, 'ES256');

  const jws = await new SignJWT({
    presentationId,
    holder,
    credentialIds: credentials.map((c) => c.credentialId),
    credentialCount: credentials.length,
  })
    .setProtectedHeader({ alg: 'ES256', typ: 'vp+jwt' })
    .setIssuedAt()
    .setIssuer(holder)
    .setJti(presentationId)
    .setExpirationTime(opts.expiresAt ?? '1h')
    .sign(privateKey);

  const presentation: VerifiablePresentation = {
    presentationId,
    holder,
    credentials: disclosedCredentials,
    disclosedClaims: opts.disclosedClaims,
    signature: jws,
    createdAt: now,
    expiresAt: opts.expiresAt,
  };

  presentations.set(presentationId, presentation);

  log('info', 'presentation_created', {
    presentationId,
    holder,
    credentialCount: credentials.length,
  });

  return presentation;
}

/** Retrieve a stored presentation by ID. */
export function getPresentation(presentationId: string): VerifiablePresentation | null {
  return presentations.get(presentationId) ?? null;
}

/** List all presentations for a holder. */
export function getPresentationsForHolder(holder: string): VerifiablePresentation[] {
  return Array.from(presentations.values()).filter((p) => p.holder === holder);
}

/** Count all stored presentations. */
export function presentationCount(): number {
  return presentations.size;
}
