import { randomBytes, randomUUID } from 'crypto';

export type CredentialFormat = 'vc+sd-jwt' | 'jwt_vc_json';

export interface CredentialTemplate {
  id: string;
  format: CredentialFormat;
  types: string[];
  display?: Array<{
    locale: string;
    name: string;
    description?: string;
  }>;
  schema?: {
    id: string;
    type: string;
  };
}

export interface IssuerMetadata {
  credential_issuer: string;
  supported_credential_formats: CredentialFormat[];
  authorization_server: string;
  credential_endpoint: string;
}

export interface CredentialOfferPayload {
  credential_issuer: string;
  credentials: Array<{
    format: CredentialFormat;
    types: string[];
    display?: CredentialTemplate['display'];
    schema?: CredentialTemplate['schema'];
  }>;
  grants: {
    'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
      'pre-authorized_code': string;
      user_pin_required: boolean;
      'tx_code'?: string;
    };
  };
  expires_in?: number;
}

export interface CredentialOfferResult {
  offerId: string;
  credentialId: string;
  format: CredentialFormat;
  nonce: string;
  preAuthorizedCode: string;
  expiresAt: number;
  issuerMetadata: IssuerMetadata;
  credentialOffer: CredentialOfferPayload;
  credentialOfferUri: string;
  qrPayload: string;
}

export interface AccessTokenRecord {
  token: string;
  offerId: string;
  credentialId: string;
  subjectDid?: string;
  scope?: string[];
  issuedAt: number;
  expiresAt: number;
  jkt?: string;
  lastSeenAt?: number;
}

interface OfferRecord {
  offerId: string;
  credentialId: string;
  template: CredentialTemplate;
  nonce: string;
  preAuthorizedCode: string;
  issuerMetadata: IssuerMetadata;
  credentialOffer: CredentialOfferPayload;
  createdAt: number;
  expiresAt: number;
}

interface NonceRecord {
  value: string;
  expiresAt: number;
  metadata?: Record<string, unknown>;
}

interface CreateOfferOptions {
  subjectHint?: string;
  ttlSeconds?: number;
}

interface RedeemOptions {
  subjectDid?: string;
  scope?: string[];
  jkt?: string;
  ttlSeconds?: number;
}

const DEFAULT_OFFER_TTL_SECONDS = parseInteger(process.env.OIDC4VCI_OFFER_TTL_SECONDS, 600);
const DEFAULT_TOKEN_TTL_SECONDS = parseInteger(process.env.OIDC4VCI_TOKEN_TTL_SECONDS, 900);
const DEFAULT_C_NONCE_TTL_SECONDS = parseInteger(process.env.OIDC4VCI_C_NONCE_TTL_SECONDS, 300);

const DEFAULT_TEMPLATES: Record<string, CredentialTemplate> = {
  'passport-v3': {
    id: 'passport-v3',
    format: 'vc+sd-jwt',
    types: ['VerifiableCredential', 'VitalPassport', 'VitalPassportV3'],
    display: [
      {
        locale: 'en-US',
        name: 'Vital Passport v3',
        description: 'Consolidated state license, DEA, privilege, and OPPE snapshot.',
      },
    ],
    schema: {
      id: 'https://docs.vitalcv.health/credentials/passport-v3',
      type: 'json-schema',
    },
  },
  'dea-registration': {
    id: 'dea-registration',
    format: 'jwt_vc_json',
    types: ['VerifiableCredential', 'DEARegistrationCredential'],
    display: [
      {
        locale: 'en-US',
        name: 'DEA Registration',
        description: 'Schedules and status for the clinician DEA registration.',
      },
    ],
    schema: {
      id: 'https://docs.vitalcv.health/credentials/dea-registration',
      type: 'json-schema',
    },
  },
  default: {
    id: 'vital-generic',
    format: 'jwt_vc_json',
    types: ['VerifiableCredential', 'VitalCredential'],
    display: [
      {
        locale: 'en-US',
        name: 'Vital Credential',
        description: 'Generic VitalCV-issued credential envelope.',
      },
    ],
  },
};

export class CredentialOfferService {
  private readonly offers = new Map<string, OfferRecord>();
  private readonly codes = new Map<string, OfferRecord>();
  private readonly tokens = new Map<string, AccessTokenRecord>();
  private readonly cNonces = new Map<string, NonceRecord>();

  constructor(private readonly templates: Record<string, CredentialTemplate> = DEFAULT_TEMPLATES) {}

  getIssuerMetadata(): IssuerMetadata {
    const issuer = resolveIssuerBaseUrl();
    const credentialEndpoint = resolveCredentialEndpoint();
    const authorizationServer = resolveAuthorizationServer();
    const supportedFormats = Array.from(
      new Set(
        Object.values(this.templates)
          .filter(Boolean)
          .map((template) => template.format),
      ),
    );

    return {
      credential_issuer: issuer,
      supported_credential_formats: supportedFormats as CredentialFormat[],
      authorization_server: authorizationServer,
      credential_endpoint: credentialEndpoint,
    };
  }

  createOffer(credentialId: string, options: CreateOfferOptions = {}): CredentialOfferResult {
    this.purgeExpired();
    const template = this.getTemplate(credentialId);
    const nonce = randomBase64Url(12);
    const preAuthorizedCode = randomBase64Url(24);
    const issuerMetadata = this.getIssuerMetadata();
    const createdAt = Date.now();
    const expiresInSeconds = options.ttlSeconds ?? DEFAULT_OFFER_TTL_SECONDS;
    const expiresAt = createdAt + expiresInSeconds * 1000;
    const offerId = randomUUID();

    const credentialOffer: CredentialOfferPayload = {
      credential_issuer: issuerMetadata.credential_issuer,
      credentials: [
        {
          format: template.format,
          types: template.types,
          display: template.display,
          schema: template.schema,
        },
      ],
      grants: {
        'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
          'pre-authorized_code': preAuthorizedCode,
          user_pin_required: false,
        },
      },
      expires_in: expiresInSeconds,
    };

    const record: OfferRecord = {
      offerId,
      credentialId: template.id,
      template,
      nonce,
      preAuthorizedCode,
      issuerMetadata,
      credentialOffer,
      createdAt,
      expiresAt,
    };

    this.offers.set(offerId, record);
    this.codes.set(preAuthorizedCode, record);

    const encodedOffer = encodeURIComponent(JSON.stringify(credentialOffer));
    const credentialOfferUri = `data:application/json,${encodedOffer}`;
    const qrPayload = `openid-credential-offer://?credential_offer=${encodedOffer}`;

    return {
      offerId,
      credentialId: template.id,
      format: template.format,
      nonce,
      preAuthorizedCode,
      expiresAt,
      issuerMetadata,
      credentialOffer,
      credentialOfferUri,
      qrPayload,
    };
  }

  redeemPreAuthorizedCode(code: string, options: RedeemOptions = {}): AccessTokenRecord {
    this.purgeExpired();
    const record = this.codes.get(code);
    if (!record) {
      throw new Error('invalid_pre_authorized_code');
    }

    this.codes.delete(code);

    const issuedAt = Date.now();
    const ttlSeconds = options.ttlSeconds ?? DEFAULT_TOKEN_TTL_SECONDS;
    const tokenRecord: AccessTokenRecord = {
      token: randomBase64Url(32),
      offerId: record.offerId,
      credentialId: record.credentialId,
      subjectDid: options.subjectDid,
      scope: options.scope,
      issuedAt,
      expiresAt: issuedAt + ttlSeconds * 1000,
      jkt: options.jkt,
    };

    this.tokens.set(tokenRecord.token, tokenRecord);
    return tokenRecord;
  }

  validateAccessToken(token: string, params: { jkt?: string } = {}): AccessTokenRecord {
    this.purgeExpired();
    const record = this.tokens.get(token);
    if (!record) {
      throw new Error('invalid_token');
    }
    if (record.expiresAt <= Date.now()) {
      this.tokens.delete(token);
      throw new Error('expired_token');
    }
    if (params.jkt) {
      if (record.jkt && record.jkt !== params.jkt) {
        throw new Error('dpop_jkt_mismatch');
      }
      if (!record.jkt) {
        // Bind on first validated use if issuance service didn't provide one.
        record.jkt = params.jkt;
      }
    }
    record.lastSeenAt = Date.now();
    return record;
  }

  issueCredentialNonce(metadata?: Record<string, unknown>): { value: string; expiresIn: number } {
    this.purgeExpired();
    const value = randomBase64Url(16);
    const expiresAt = Date.now() + DEFAULT_C_NONCE_TTL_SECONDS * 1000;
    this.cNonces.set(value, { value, expiresAt, metadata });
    return { value, expiresIn: DEFAULT_C_NONCE_TTL_SECONDS };
  }

  getTemplate(credentialId: string): CredentialTemplate {
    return this.templates[credentialId] ?? this.templates.default;
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const record of this.offers.values()) {
      if (record.expiresAt <= now) {
        this.offers.delete(record.offerId);
      }
    }
    for (const [code, offer] of this.codes.entries()) {
      if (offer.expiresAt <= now) {
        this.codes.delete(code);
      }
    }
    for (const [token, accessToken] of this.tokens.entries()) {
      if (accessToken.expiresAt <= now) {
        this.tokens.delete(token);
      }
    }
    for (const [nonce, nonceRecord] of this.cNonces.entries()) {
      if (nonceRecord.expiresAt <= now) {
        this.cNonces.delete(nonce);
      }
    }
  }
}

export const credentialOfferService = new CredentialOfferService();

function resolveIssuerBaseUrl(): string {
  const configured =
    process.env.OIDC4VCI_ISSUER_BASE ||
    process.env.PUBLIC_URL ||
    (process.env.VERCEL_URL?.startsWith('http') ? process.env.VERCEL_URL : undefined);
  const base = configured ?? 'http://localhost:4000';
  return base.replace(/\/+$/, '');
}

function resolveCredentialEndpoint(): string {
  if (process.env.OIDC4VCI_CREDENTIAL_ENDPOINT) {
    return process.env.OIDC4VCI_CREDENTIAL_ENDPOINT;
  }
  const apiBase = process.env.OIDC4VCI_API_BASE || `${resolveIssuerBaseUrl()}/api`;
  return `${apiBase.replace(/\/+$/, '')}/oidc4vci/credential`;
}

function resolveAuthorizationServer(): string {
  if (process.env.OIDC4VCI_AUTHORIZATION_SERVER) {
    return process.env.OIDC4VCI_AUTHORIZATION_SERVER;
  }
  const apiBase = process.env.OIDC4VCI_API_BASE || `${resolveIssuerBaseUrl()}/api`;
  return `${apiBase.replace(/\/+$/, '')}/oidc4vci/token`;
}

function randomBase64Url(size: number): string {
  return randomBytes(size)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}


