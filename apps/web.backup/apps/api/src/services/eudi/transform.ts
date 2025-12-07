import type { WalletCredential } from '@prisma/client';

import {
  getEudiIssuerProfile,
  resolveProfileForCredentialType,
  type CredentialFormat,
  type EudiCredentialProfile,
} from './issuer';

export type SelectiveDisclosureCategory = 'identity' | 'qualifications' | 'sanctionFree';

export interface VitalCredentialEnvelope {
  id: string;
  type: string;
  issuer: {
    id: string;
    name?: string | null;
  };
  subjectId: string;
  claims: Record<string, unknown>;
  status?: string | null;
  issuedAt: string;
  expiresAt?: string | null;
}

export interface SelectiveDisclosureRequest {
  identity?: boolean;
  qualifications?: boolean;
  sanctionFree?: boolean;
  explicitFields?: Record<string, string[]>;
}

export interface SelectiveDisclosureFrameEntry {
  path: string;
  category: SelectiveDisclosureCategory | 'explicit';
  required: boolean;
  label?: string;
}

export interface SelectiveDisclosureResult {
  frame: SelectiveDisclosureFrameEntry[];
  requestedFields: Record<string, unknown>;
}

export interface EudiPresentationEnvelope {
  profile: EudiCredentialProfile;
  format: CredentialFormat;
  credential: VitalCredentialEnvelope;
  vp: {
    '@context': string[];
    type: string[];
    holder: string;
    verifiableCredential: Record<string, unknown>[];
    presentation_submission: {
      definition_id: string;
      descriptor_map: Array<{ id: string; format: CredentialFormat; path: string }>;
    };
    selective_disclosure: SelectiveDisclosureResult;
  };
  warnings: string[];
}

const SELECTIVE_DISCLOSURE_FIELDS: Record<SelectiveDisclosureCategory, string[]> = {
  identity: [
    'credentialSubject.name.first',
    'credentialSubject.name.last',
    'credentialSubject.fullName',
    'credentialSubject.npi',
    'credentialSubject.id',
  ],
  qualifications: [
    'credentialSubject.license.number',
    'credentialSubject.license.status',
    'credentialSubject.license.state',
    'credentialSubject.board.primary',
    'credentialSubject.board.subspecialty',
    'credentialSubject.board.status',
  ],
  sanctionFree: [
    'credentialSubject.sanction.status',
    'credentialSubject.sanction.lastChecked',
    'credentialSubject.board.goodStanding',
  ],
};

export function normalizeWalletCredential(
  credential: WalletCredential | VitalCredentialEnvelope,
): VitalCredentialEnvelope {
  if (isNormalized(credential)) {
    return credential;
  }

  const payload = (credential.payload ?? {}) as Record<string, unknown>;
  const metadata =
    'metadata' in credential && credential.metadata && typeof credential.metadata === 'object'
      ? (credential.metadata as Record<string, unknown>)
      : {};
  const claims =
    ('claims' in payload && typeof payload.claims === 'object'
      ? (payload.claims as Record<string, unknown>)
      : payload) ?? {};

  return {
    id: credential.credentialId,
    type: credential.type,
    issuer: {
      id: (metadata.issuerId as string) ?? 'did:web:issuer.vitalcv.health',
      name: (metadata.issuerName as string) ?? 'VitalCV',
    },
    subjectId:
      (claims.credentialSubject && typeof claims.credentialSubject === 'object'
        ? ((claims.credentialSubject as Record<string, unknown>).id as string | undefined) ?? ''
        : '') || credential.clinicianId,
    claims,
    status: credential.revokedAt ? 'revoked' : 'valid',
    issuedAt: credential.issuedAt.toISOString(),
    expiresAt: credential.updatedAt?.toISOString() ?? null,
  };
}

export function transformVitalCredentialToEudiPresentation(params: {
  credential: WalletCredential | VitalCredentialEnvelope;
  profileId?: string;
  holderDid?: string;
  selectiveDisclosure?: SelectiveDisclosureRequest;
}): EudiPresentationEnvelope {
  const normalized = normalizeWalletCredential(params.credential);
  const profile =
    (params.profileId && getEudiIssuerProfile(params.profileId)) ||
    resolveProfileForCredentialType(normalized.type);

  if (!profile) {
    throw new Error(`No EUDI issuer profile found for credential type ${normalized.type}`);
  }

  const holderDid = params.holderDid ?? normalized.subjectId ?? `did:key:${normalized.id}`;
  const disclosureResult = buildSelectiveDisclosure(
    normalized,
    profile,
    params.selectiveDisclosure,
  );
  const vc = buildVerifiableCredential(normalized, profile, holderDid, disclosureResult);

  return {
    profile,
    format: profile.format,
    credential: normalized,
    warnings: disclosureResult.warnings,
    vp: {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://europa.eu/schemas/vp/v1',
        'https://docs.vitalcv.health/contexts/eudi-wallet.json',
      ],
      type: ['VerifiablePresentation', 'EudiWalletPresentation'],
      holder: holderDid,
      verifiableCredential: [vc],
      presentation_submission: {
        definition_id: profile.presentationDefinitionId,
        descriptor_map: [
          {
            id: profile.profileId,
            format: profile.format,
            path: '$.verifiableCredential[0]',
          },
        ],
      },
      selective_disclosure: {
        frame: disclosureResult.frame,
        requestedFields: disclosureResult.disclosedClaims,
      },
    },
  };
}

function buildVerifiableCredential(
  credential: VitalCredentialEnvelope,
  profile: EudiCredentialProfile,
  holderDid: string,
  disclosureResult: ReturnType<typeof buildSelectiveDisclosure>,
) {
  const issuanceDate = credential.issuedAt ?? new Date().toISOString();

  return {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://schema.org',
      profile.schemaUri,
    ],
    type: Array.from(new Set(['VerifiableCredential', profile.vcType])),
    issuer: profile.issuerDid,
    issuanceDate,
    expirationDate: credential.expiresAt ?? undefined,
    credentialSchema: {
      id: profile.schemaUri,
      type: 'JsonSchema',
    },
    credentialSubject: {
      id: holderDid,
      credentialId: credential.id,
      ...disclosureResult.disclosedClaims.credentialSubject,
    },
    evidence: profile.evidenceTypes.map((type) => ({
      id: `${credential.id}:${type}`,
      type: type.toUpperCase(),
      verifier: profile.issuerDid,
    })),
    credentialStatus: {
      id: `${profile.issuerDid}/status/${profile.profileId}`,
      type: 'StatusList2021Entry',
      statusPurpose: 'revocation',
      statusListIndex: 0,
      statusListCredential: `${profile.issuerDid}/status/${profile.profileId}`,
    },
  };
}

function buildSelectiveDisclosure(
  credential: VitalCredentialEnvelope,
  profile: EudiCredentialProfile,
  request?: SelectiveDisclosureRequest,
) {
  const categories: SelectiveDisclosureCategory[] = [];
  if (!request || request.identity !== false) {
    categories.push('identity');
  }
  if (!request || request.qualifications !== false) {
    categories.push('qualifications');
  }
  if (!request || request.sanctionFree !== false) {
    categories.push('sanctionFree');
  }

  const frame: SelectiveDisclosureFrameEntry[] = [];
  const disclosedClaims: Record<string, unknown> = {
    credentialSubject: {},
  };
  const warnings: string[] = [];

  for (const category of categories) {
    const paths =
      request?.explicitFields?.[category] ??
      profile.defaultFields[category] ??
      SELECTIVE_DISCLOSURE_FIELDS[category];

    for (const path of paths) {
      const value = readFromClaims(credential.claims, path);
      frame.push({
        path,
        category,
        required: true,
      });

      if (typeof value === 'undefined') {
        warnings.push(`Missing disclosure field ${path}`);
        continue;
      }

      writeToClaims(disclosedClaims, path, value);
    }
  }

  if (request?.explicitFields) {
    for (const [key, paths] of Object.entries(request.explicitFields)) {
      for (const path of paths) {
        const value = readFromClaims(credential.claims, path);
        frame.push({
          path,
          category: key as SelectiveDisclosureCategory | 'explicit',
          required: true,
        });
        if (typeof value === 'undefined') {
          warnings.push(`Missing explicit disclosure field ${path}`);
          continue;
        }
        writeToClaims(disclosedClaims, path, value);
      }
    }
  }

  return {
    frame,
    disclosedClaims,
    warnings,
  };
}

function readFromClaims(source: Record<string, unknown>, path: string): unknown {
  const segments = path.split('.');
  let cursor: any = source;
  for (const segment of segments) {
    if (cursor == null || typeof cursor !== 'object') {
      return undefined;
    }
    cursor = cursor[segment];
  }
  return cursor;
}

function writeToClaims(target: Record<string, unknown>, path: string, value: unknown) {
  const segments = path.split('.');
  let cursor: any = target;
  for (let i = 0; i < segments.length; i += 1) {
    const key = segments[i]!;
    if (i === segments.length - 1) {
      cursor[key] = value;
      return;
    }
    if (!cursor[key] || typeof cursor[key] !== 'object') {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
}

function isNormalized(value: any): value is VitalCredentialEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'claims' in value &&
    'issuer' in value
  );
}


