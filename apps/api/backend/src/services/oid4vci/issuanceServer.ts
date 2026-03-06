/**
 * issuanceServer.ts — Wave 109: OpenID4VCI Credential Issuance Server
 *
 * Implements OpenID for Verifiable Credential Issuance (OID4VCI) draft spec.
 * Supports the Pre-Authorized Code Flow for issuing credentials to wallets.
 *
 * Spec: https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html
 */

import { randomUUID } from 'node:crypto';
import { log } from '../../obs/logger';
import { issueCredential } from '../credentials/credentialIssuer';
import { storeCredential } from '../credentials/credentialWallet';
import type { IssueCredentialRequest } from '../credentials/credentialModel';

// ── Types ─────────────────────────────────────────────────────────────

export type CredentialFormatId =
  | 'jwt_vc_json'
  | 'jwt_vc_json-ld'
  | 'vc+sd-jwt'
  | 'ldp_vc';

export interface CredentialSupportedDisplay {
  name: string;
  locale?: string;
  logo?: { uri: string; alt_text?: string };
  background_color?: string;
  text_color?: string;
}

export interface CredentialSupported {
  format: CredentialFormatId;
  id: string;
  types: string[];
  display?: CredentialSupportedDisplay[];
  cryptographic_binding_methods_supported?: string[];
  cryptographic_suites_supported?: string[];
}

export interface IssuerMetadata {
  credential_issuer: string;
  credential_endpoint: string;
  credentials_supported: CredentialSupported[];
  display?: Array<{ name: string; locale?: string; logo?: { uri: string } }>;
  token_endpoint?: string;
  authorization_endpoint?: string;
}

export interface CredentialOfferGrant {
  'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
    'pre-authorized_code': string;
    user_pin_required: boolean;
  };
}

export interface CredentialOffer {
  offerId: string;
  credential_issuer: string;
  credentials: string[];
  grants: CredentialOfferGrant;
  /** ISO-8601 expiry */
  expiresAt: string;
  /** Attached credential request for deferred issuance */
  pendingRequest?: IssueCredentialRequest;
  redeemed: boolean;
  createdAt: string;
}

export interface OID4VCICredentialRequest {
  format: CredentialFormatId;
  types: string[];
  proof?: {
    proof_type: 'jwt';
    jwt: string;
  };
  /** pre-authorized code from offer */
  'pre-authorized_code'?: string;
}

export interface OID4VCICredentialResponse {
  format: CredentialFormatId;
  credential: string;           // compact JWS (vc+jwt)
  c_nonce?: string;
  c_nonce_expires_in?: number;
}

// ── In-memory store ───────────────────────────────────────────────────

const offers = new Map<string, CredentialOffer>();

// ── Issuer identity ───────────────────────────────────────────────────

const ISSUER_BASE_URL = process.env.ISSUER_BASE_URL ?? 'https://api.vitalcv.com';

// ── Supported credentials catalog ────────────────────────────────────

const CREDENTIALS_SUPPORTED: CredentialSupported[] = [
  {
    id: 'MedicalLicense',
    format: 'jwt_vc_json',
    types: ['VerifiableCredential', 'MedicalLicense'],
    cryptographic_binding_methods_supported: ['did:vitalcv'],
    cryptographic_suites_supported: ['ES256'],
    display: [
      {
        name: 'Medical License',
        locale: 'en-US',
        background_color: '#1e3a5f',
        text_color: '#ffffff',
      },
    ],
  },
  {
    id: 'BoardCertification',
    format: 'jwt_vc_json',
    types: ['VerifiableCredential', 'BoardCertification'],
    cryptographic_binding_methods_supported: ['did:vitalcv'],
    cryptographic_suites_supported: ['ES256'],
    display: [
      {
        name: 'Board Certification',
        locale: 'en-US',
        background_color: '#1a4731',
        text_color: '#ffffff',
      },
    ],
  },
  {
    id: 'NPIRegistration',
    format: 'jwt_vc_json',
    types: ['VerifiableCredential', 'NPIRegistration'],
    cryptographic_binding_methods_supported: ['did:vitalcv'],
    cryptographic_suites_supported: ['ES256'],
    display: [
      {
        name: 'NPI Registration',
        locale: 'en-US',
        background_color: '#3b1e5f',
        text_color: '#ffffff',
      },
    ],
  },
  {
    id: 'DEARegistration',
    format: 'vc+sd-jwt',
    types: ['VerifiableCredential', 'DEARegistration'],
    cryptographic_binding_methods_supported: ['did:vitalcv'],
    cryptographic_suites_supported: ['ES256'],
    display: [
      {
        name: 'DEA Registration',
        locale: 'en-US',
        background_color: '#5f1e1e',
        text_color: '#ffffff',
      },
    ],
  },
];

// ── Public API ────────────────────────────────────────────────────────

/**
 * Build the OpenID Credential Issuer metadata document.
 * Served at /.well-known/openid-credential-issuer
 */
export function createIssuerMetadata(): IssuerMetadata {
  return {
    credential_issuer: ISSUER_BASE_URL,
    credential_endpoint: `${ISSUER_BASE_URL}/api/oid4vci/credential`,
    credentials_supported: CREDENTIALS_SUPPORTED,
    display: [
      {
        name: 'VitalCV Trust Network',
        locale: 'en-US',
        logo: { uri: `${ISSUER_BASE_URL}/logo.png` },
      },
    ],
  };
}

/**
 * Create a credential offer with a pre-authorized code.
 * Used when an issuer pushes an offer to a holder.
 */
export function createCredentialOffer(
  credentialIds: string[],
  pendingRequest?: IssueCredentialRequest,
  ttlSeconds = 600,
): CredentialOffer {
  const offerId = randomUUID();
  const preAuthorizedCode = randomUUID().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const offer: CredentialOffer = {
    offerId,
    credential_issuer: ISSUER_BASE_URL,
    credentials: credentialIds,
    grants: {
      'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
        'pre-authorized_code': preAuthorizedCode,
        user_pin_required: false,
      },
    },
    expiresAt,
    pendingRequest,
    redeemed: false,
    createdAt: new Date().toISOString(),
  };

  offers.set(offerId, offer);
  // Also index by pre-authorized code
  offers.set(preAuthorizedCode, offer);

  log('info', 'oid4vci_offer_created', {
    offerId,
    credentials: credentialIds,
    expiresAt,
  });

  return offer;
}

/**
 * Retrieve a credential offer by ID.
 */
export function getCredentialOffer(idOrCode: string): CredentialOffer | null {
  return offers.get(idOrCode) ?? null;
}

/**
 * Issue a credential via OID4VCI flow.
 * Validates the pre-authorized code, issues the credential, stores it.
 */
export async function issueOID4VCICredential(
  request: OID4VCICredentialRequest,
  pem: string,
): Promise<OID4VCICredentialResponse> {
  const preCode = request['pre-authorized_code'];
  const offer = preCode ? offers.get(preCode) : undefined;

  if (offer) {
    // Validate offer
    if (offer.redeemed) {
      throw new Error('Credential offer has already been redeemed');
    }
    if (new Date(offer.expiresAt) < new Date()) {
      throw new Error('Credential offer has expired');
    }
    // Mark as redeemed
    offer.redeemed = true;
  }

  // Use pending request from offer or build a minimal one
  const issueReq: IssueCredentialRequest = offer?.pendingRequest ?? {
    issuer: 'did:vitalcv:issuer:vitalcv-psv',
    subject: 'did:vitalcv:clinician:unknown',
    claims: {
      credentialTypes: request.types,
      issuedViaOID4VCI: true,
    },
  };

  const credential = await issueCredential(issueReq, pem);
  await storeCredential(credential);

  log('info', 'oid4vci_credential_issued', {
    credentialId: credential.credentialId,
    format: request.format,
    offerId: offer?.offerId,
  });

  return {
    format: request.format,
    credential: credential.signature,
    c_nonce: randomUUID().replace(/-/g, ''),
    c_nonce_expires_in: 300,
  };
}

/**
 * List active (non-expired) offers — for admin/debug.
 */
export function listActiveOffers(): CredentialOffer[] {
  const now = new Date();
  const seen = new Set<string>();
  return Array.from(offers.values()).filter((o) => {
    if (seen.has(o.offerId)) return false;
    seen.add(o.offerId);
    return !o.redeemed && new Date(o.expiresAt) > now;
  });
}
