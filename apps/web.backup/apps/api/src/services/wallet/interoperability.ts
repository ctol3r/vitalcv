import { differenceInMinutes, isBefore } from 'date-fns';
import { createHash } from 'crypto';

import type { EudiCredentialProfile } from '../eudi/issuer';
import type { EudiPresentationEnvelope, VitalCredentialEnvelope } from '../eudi/transform';

export interface WalletInteroperabilityFinding {
  code: string;
  message: string;
  path?: string;
}

export interface WalletInteroperabilityReport {
  ok: boolean;
  errors: WalletInteroperabilityFinding[];
  warnings: WalletInteroperabilityFinding[];
  summary: string;
}

export interface WalletSyncResult {
  wallet: string;
  synced: boolean;
  issues: WalletInteroperabilityFinding[];
  storageHandle: string | null;
}

export interface WalletSimulationResult {
  wallet: string;
  issued: boolean;
  stored: boolean;
  presented: boolean;
  errors: WalletInteroperabilityFinding[];
}

export function validateWalletInteroperability(params: {
  credential: VitalCredentialEnvelope;
  profile: EudiCredentialProfile;
  presentation: EudiPresentationEnvelope;
}): WalletInteroperabilityReport {
  const errors: WalletInteroperabilityFinding[] = [];
  const warnings: WalletInteroperabilityFinding[] = [];

  runStructureChecks(params.credential, params.profile, params.presentation, errors);
  runExpiryChecks(params.credential, errors, warnings);
  runSelectiveDisclosureChecks(params.presentation, errors);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary:
      errors.length === 0
        ? 'Credential satisfies VitalCV wallet interoperability policy.'
        : 'Credential failed interoperability policy validation.',
  };
}

function runStructureChecks(
  credential: VitalCredentialEnvelope,
  profile: EudiCredentialProfile,
  presentation: EudiPresentationEnvelope,
  errors: WalletInteroperabilityFinding[],
) {
  const subject = (presentation.vp.verifiableCredential[0]?.credentialSubject ??
    {}) as Record<string, unknown>;

  if (!subject || Object.keys(subject).length === 0) {
    errors.push({
      code: 'missingSubject',
      message: 'Credential subject is empty or missing from VP payload.',
    });
  }

  const requiredFields = profile.defaultFields.identity ?? [];
  for (const field of requiredFields) {
    if (!hasPath(subject, field)) {
      errors.push({
        code: 'missingField',
        path: field,
        message: `Credential missing required disclosure field: ${field}`,
      });
    }
  }

  if (!credential.subjectId) {
    errors.push({
      code: 'missingSubjectId',
      message: 'Credential subject identifier is missing.',
    });
  }
}

function runExpiryChecks(
  credential: VitalCredentialEnvelope,
  errors: WalletInteroperabilityFinding[],
  warnings: WalletInteroperabilityFinding[],
) {
  if (!credential.expiresAt) {
    warnings.push({
      code: 'noExpiry',
      message: 'Credential does not contain an expiry timestamp; relying parties may downgrade assurance.',
    });
    return;
  }

  const expiry = new Date(credential.expiresAt);
  if (isBefore(expiry, new Date())) {
    errors.push({
      code: 'expired',
      message: `Credential expired ${differenceInMinutes(new Date(), expiry)} minutes ago.`,
    });
  } else if (differenceInMinutes(expiry, new Date()) < 30) {
    warnings.push({
      code: 'expiringSoon',
      message: 'Credential expires within 30 minutes.',
    });
  }
}

function runSelectiveDisclosureChecks(
  presentation: EudiPresentationEnvelope,
  errors: WalletInteroperabilityFinding[],
) {
  const frame = presentation.vp.selective_disclosure.frame;
  if (!frame || frame.length === 0) {
    errors.push({
      code: 'missingSelectiveDisclosure',
      message: 'SD-JWT disclosures missing; cannot honor selective disclosure request.',
    });
  }
}

function hasPath(target: Record<string, unknown>, path: string): boolean {
  const segments = path.split('.');
  let cursor: any = target;
  for (const segment of segments) {
    if (cursor == null || typeof cursor !== 'object' || !(segment in cursor)) {
      return false;
    }
    cursor = cursor[segment];
  }
  return true;
}

export function mapNhsWalletEnvelope(credential: VitalCredentialEnvelope) {
  const subject = credential.payload?.credentialSubject ?? {};
  return {
    nhsNumber: subject.nhsNumber ?? subject.identifier ?? null,
    practitionerRole: subject.role ?? subject.providerType ?? null,
    validity: {
      issuedAt: credential.issuedAt,
      expiresAt: credential.expiresAt,
    },
    issuer: credential.issuer ?? subject.organization ?? 'did:web:nhs.vitalcv',
    hash: createHash('sha256').update(JSON.stringify(subject)).digest('hex'),
  };
}

export function buildAppleWalletPassBundle(credentials: VitalCredentialEnvelope[]) {
  return credentials.map((credential) => ({
    passTypeIdentifier: 'pass.vitalcv.wallet',
    serialNumber: credential.id ?? credential.subjectId ?? createHash('sha256').update(credential.subjectId ?? '').digest('hex'),
    description: credential.type?.join?.(', ') ?? 'VitalCV Credential',
    organizationName: credential.issuer ?? 'VitalCV',
    expirationDate: credential.expiresAt ?? null,
    fields: credential.payload ?? {},
  }));
}

export function buildGoogleWalletPassBundle(credentials: VitalCredentialEnvelope[]) {
  return credentials.map((credential) => ({
    classId: `vitalcv.${credential.type?.[0] ?? 'Credential'}`,
    id: credential.id ?? createHash('sha256').update(JSON.stringify(credential)).digest('hex'),
    issuerName: credential.issuer ?? 'VitalCV',
    validTimeInterval: {
      start: credential.issuedAt ?? new Date().toISOString(),
      end: credential.expiresAt ?? null,
    },
    payload: credential.payload ?? {},
  }));
}

export function ensureEudiCompatibility(credential: VitalCredentialEnvelope) {
  const warnings: WalletInteroperabilityFinding[] = [];
  if (!credential.payload?.credentialSchema) {
    warnings.push({
      code: 'missingSchema',
      message: 'Credential missing explicit schema reference for EUDI alignment.',
    });
  }
  if (!credential.payload?.evidence) {
    warnings.push({
      code: 'missingEvidence',
      message: 'EUDI profile requires evidence section with references.',
    });
  }
  return warnings;
}

export function runMultiWalletSimulation(params: {
  credential: VitalCredentialEnvelope;
  profile: EudiCredentialProfile;
  presentation: EudiPresentationEnvelope;
  wallets: string[];
}): WalletSimulationResult[] {
  const results: WalletSimulationResult[] = [];
  params.wallets.forEach((wallet) => {
    const errors = validateWalletInteroperability({
      credential: params.credential,
      profile: params.profile,
      presentation: params.presentation,
    }).errors.filter((finding) => finding.code !== 'missingSelectiveDisclosure' || wallet === 'EUDI');
    results.push({
      wallet,
      issued: errors.length === 0,
      stored: errors.length === 0,
      presented: errors.length === 0,
      errors,
    });
  });
  return results;
}

export function syncWallets(params: {
  credential: VitalCredentialEnvelope;
  presentation: EudiPresentationEnvelope;
  profile: EudiCredentialProfile;
  wallets: string[];
}): WalletSyncResult[] {
  return params.wallets.map((wallet) => {
    const report = validateWalletInteroperability({
      credential: params.credential,
      profile: params.profile,
      presentation: params.presentation,
    });
    return {
      wallet,
      synced: report.ok,
      issues: [...report.errors, ...report.warnings],
      storageHandle: report.ok ? `${wallet}:${createHash('sha256').update(wallet).digest('hex')}` : null,
    };
  });
}



