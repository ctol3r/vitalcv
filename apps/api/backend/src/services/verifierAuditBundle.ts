import { canonicalizeJson, sha256ForPayload } from '../utils/deterministic';
import type { TransparencyLogEntry } from './transparencyLog';

export const AUDITSCRAPBOOK_METHODLOGY_VERSION = '1.0.0';
export const AUDITSCRAPBOOK_COMPLIANCE_PROFILE = ['NCQA', 'CMS', 'VC2'] as const;
export const AUDITSCRAPBOOK_VERIFIER_IDENTITY = 'VitalCV Cross-Check Engine v1';
export const AUDITSCRAPBOOK_METHOD = 'Primary source verification via Nursys E-Notify simulation';

const DAY_MS = 24 * 60 * 60 * 1000;

type RetentionState = 'ENFORCED' | 'EXPIRING_SOON' | 'EXPIRED';
type ComplianceProfile = (typeof AUDITSCRAPBOOK_COMPLIANCE_PROFILE)[number];

type SensitiveFieldHint = {
  key: string;
  description: string;
};

const SENSITIVE_FIELD_HINTS: SensitiveFieldHint[] = [
  { key: 'ssn', description: 'social security' },
  { key: 'social', description: 'social-security' },
  { key: 'dob', description: 'date of birth' },
  { key: 'birth', description: 'birth date' },
  { key: 'phone', description: 'phone number' },
  { key: 'email', description: 'email address' },
  { key: 'address', description: 'postal address' },
  { key: 'credentialNumber', description: 'credential number' },
  { key: 'medicare', description: 'medicare token' },
  { key: 'medicaid', description: 'medicaid token' },
];

export type ArtifactForVerifierAuditBundle = {
  id: string;
  npi: string;
  source: string;
  status: string;
  checksum: string;
  merkleRoot: string;
  trustState: string;
  verifiedAt: Date;
  expiresAt: Date | null;
  monitoring: boolean;
  organizationId: string | null;
  rawPayload?: unknown;
};

type VerifierAuditContext = {
  generatedAt: string;
  verifierIdentity: string;
  methodology: string;
  monitoringStatus: string;
  snapshotId?: string;
  transparencyEntries: TransparencyLogEntry[];
};

export type VerifierAuditBundle = {
  methodologyVersion: typeof AUDITSCRAPBOOK_METHODLOGY_VERSION;
  complianceProfile: ComplianceProfile[];
  evidenceCapture: {
    artifactId: string;
    npi: string;
    source: string;
    status: string;
    trustState: string;
    snapshotId: string | null;
    generatedAt: string;
    verifierIdentity: string;
    methodology: string;
    monitoringStatus: string;
    organizationId: string | null;
    integrity: {
      checksum: string;
      merkleRoot: string;
      rawPayloadHash: string;
      canonicalizer: 'canonicalizeJson/v1';
    };
  };
  tamperAnchoring: {
    algorithm: 'sha256-canonical-json-v1';
    chainVersion: '1.0.0';
    transparencyEntryCount: number;
    chainSeed: string;
    chainDigest: string;
    chain: Array<{
      index: number;
      createdAt: string;
      fingerprint: string;
      merkleRoot: string;
      lifecycleState: string;
      previousDigest: string;
      digest: string;
    }>;
  };
  retentionTagEnforcement: {
    retentionTag: 'ACTIVE_MONITORING' | 'STANDARD';
    complianceProfile: ComplianceProfile[];
    retentionDays: number;
    retainedUntil: string;
    retentionState: RetentionState;
    reason: string;
  };
  consentRedactionLog: {
    consentMode: 'public-source-basis';
    explicitConsentRequired: boolean;
    policyVersion: '1.0.0';
    recordedAt: string;
    redactedFields: string[];
    redactionPolicy: string;
    redactionDigest: string;
  };
  legalMetadataMapping: {
    mappingVersion: '1.0.0';
    profiles: {
      profile: ComplianceProfile;
      basis: string;
      mapping: string;
    }[];
    legalScope: string;
  };
};

function toIso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date(0).toISOString();
  }
  return date.toISOString();
}

function hashPayload(payload: unknown): string {
  try {
    return sha256ForPayload(payload);
  } catch {
    return sha256ForPayload({});
  }
}

function normalizeRetentionDays(artifactMonitoring: boolean): number {
  return artifactMonitoring ? 120 : 365;
}

function retentionState(retentionEnds: Date): RetentionState {
  const remainingMs = retentionEnds.getTime() - Date.now();
  const remainingDays = Math.floor(remainingMs / DAY_MS);
  if (remainingDays <= 0) {
    return 'EXPIRED';
  }
  if (remainingDays <= 30) {
    return 'EXPIRING_SOON';
  }
  return 'ENFORCED';
}

function collectSensitivePaths(payload: unknown, path: string, paths: Set<string>): void {
  if (payload === null || payload === undefined) {
    return;
  }
  if (payload instanceof Date) {
    return;
  }
  if (typeof payload !== 'object') {
    return;
  }

  if (Array.isArray(payload)) {
    for (const [index, item] of payload.entries()) {
      const nextPath = path.length > 0 ? `${path}[${index}]` : `[${index}]`;
      collectSensitivePaths(item, nextPath, paths);
    }
    return;
  }

  const record = payload as Record<string, unknown>;
  for (const key of Object.keys(record).sort()) {
    const nextPath = path.length > 0 ? `${path}.${key}` : key;
    const lowered = key.toLowerCase();
    if (SENSITIVE_FIELD_HINTS.some((hint) => lowered.includes(hint.key.toLowerCase()))) {
      paths.add(nextPath);
    }
    collectSensitivePaths(record[key], nextPath, paths);
  }
}

function buildAnchoring(
  artifact: ArtifactForVerifierAuditBundle,
  generatedAt: string,
  entries: TransparencyLogEntry[],
): VerifierAuditBundle['tamperAnchoring'] {
  const orderedEntries = [...entries]
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
    .map((entry, index) => ({
      index,
      createdAt: toIso(entry.createdAt),
      fingerprint: entry.fingerprint,
      merkleRoot: entry.merkleRoot,
      lifecycleState: entry.lifecycleState,
      previousDigest: '',
      digest: '',
    }));

  let previousDigest = hashPayload({
    artifactId: artifact.id,
    npi: artifact.npi,
    method: AUDITSCRAPBOOK_METHOD,
    generatedAt,
    checksum: artifact.checksum,
    merkleRoot: artifact.merkleRoot,
    complianceProfile: AUDITSCRAPBOOK_COMPLIANCE_PROFILE,
  });

  const chain = orderedEntries.map((entry) => {
    const digest = hashPayload({
      index: entry.index,
      previousDigest,
      createdAt: entry.createdAt,
      fingerprint: entry.fingerprint,
      merkleRoot: entry.merkleRoot,
      lifecycleState: entry.lifecycleState,
    });
    const chainEntry = {
      ...entry,
      previousDigest,
      digest,
    };
    previousDigest = digest;
    return chainEntry;
  });

  const chainSeed = hashPayload({
    artifactId: artifact.id,
    checksum: artifact.checksum,
    merkleRoot: artifact.merkleRoot,
    generatedAt,
  });

  if (chain.length === 0) {
    return {
      algorithm: 'sha256-canonical-json-v1',
      chainVersion: '1.0.0',
      transparencyEntryCount: 0,
      chainSeed,
      chainDigest: previousDigest,
      chain: [],
    };
  }

  return {
    algorithm: 'sha256-canonical-json-v1',
    chainVersion: '1.0.0',
    transparencyEntryCount: chain.length,
    chainSeed,
    chainDigest: previousDigest,
    chain,
  };
}

function buildRetentionTag(artifact: ArtifactForVerifierAuditBundle, generatedAt: string): {
  retentionTag: 'ACTIVE_MONITORING' | 'STANDARD';
  retentionDays: number;
  retainedUntil: string;
  retentionState: RetentionState;
  reason: string;
} {
  const retentionTag: 'ACTIVE_MONITORING' | 'STANDARD' = artifact.monitoring
    ? 'ACTIVE_MONITORING'
    : 'STANDARD';
  const retentionDays = normalizeRetentionDays(artifact.monitoring);
  const generatedDate = new Date(generatedAt);
  const retainedUntilDate = new Date(
    generatedDate.getTime() + retentionDays * DAY_MS,
  );

  const retainedUntil = toIso(retainedUntilDate);
  const state = retentionState(retainedUntilDate);
  const reason = artifact.monitoring
    ? 'Active monitoring keeps evidence fresh for NCQA review.'
    : 'Standard evidence retention supports audit replay requirements.';

  return {
    retentionTag,
    retentionDays,
    retainedUntil,
    retentionState: state,
    reason,
  };
}

function buildRedactionLog(artifact: ArtifactForVerifierAuditBundle, generatedAt: string): {
  redactedFields: string[];
  redactionDigest: string;
} {
  const sensitivePaths = new Set<string>();
  collectSensitivePaths(artifact.rawPayload, '', sensitivePaths);
  const redactedFields = [...sensitivePaths].sort();
  const redactionDigest = hashPayload({
    artifactId: artifact.id,
    generatedAt,
    redactedFields,
    policy: 'minimum-necessary',
  });

  return {
    redactedFields,
    redactionDigest,
  };
}

function buildLegalMetadataMapping(): VerifierAuditBundle['legalMetadataMapping'] {
  return {
    mappingVersion: '1.0.0',
    legalScope: 'US',
    profiles: [
      {
        profile: 'NCQA',
        basis: 'Primary source verification evidence retention and integrity',
        mapping: canonicalizeJson({
          framework: 'NCQA',
          controls: [
            'source-verification evidence integrity',
            'artifact lifecycle auditability',
            'cross-check chainability',
          ],
        }),
      },
      {
        profile: 'CMS',
        basis: 'Professional credential verification records',
        mapping: canonicalizeJson({
          framework: 'CMS',
          controls: [
            'provider identity fidelity',
            'evidence timeline reconstruction',
          ],
        }),
      },
      {
        profile: 'VC2',
        basis: 'Verifiable Credential compliance controls',
        mapping: canonicalizeJson({
          framework: 'VC2',
          controls: [
            'tamper evidence',
            'evidence redaction policy',
            'auditable export state',
          ],
        }),
      },
    ],
  };
}

export function buildVerifierAuditBundle(
  artifact: ArtifactForVerifierAuditBundle,
  context: VerifierAuditContext,
): VerifierAuditBundle {
  const generatedAt = toIso(context.generatedAt);
  const rawPayloadHash = hashPayload(artifact.rawPayload ?? {});
  const retentionTag = buildRetentionTag(artifact, generatedAt);
  const redactionInfo = buildRedactionLog(artifact, generatedAt);
  const tamperAnchoring = buildAnchoring(artifact, generatedAt, context.transparencyEntries);

  return {
    methodologyVersion: AUDITSCRAPBOOK_METHODLOGY_VERSION,
    complianceProfile: [...AUDITSCRAPBOOK_COMPLIANCE_PROFILE],
    evidenceCapture: {
      artifactId: artifact.id,
      npi: artifact.npi,
      source: artifact.source,
      status: artifact.status,
      trustState: artifact.trustState,
      snapshotId: context.snapshotId?.trim().length ? context.snapshotId : null,
      generatedAt,
      verifierIdentity: context.verifierIdentity,
      methodology: context.methodology,
      monitoringStatus: context.monitoringStatus,
      organizationId: artifact.organizationId,
      integrity: {
        checksum: artifact.checksum,
        merkleRoot: artifact.merkleRoot,
        rawPayloadHash,
        canonicalizer: 'canonicalizeJson/v1',
      },
    },
    tamperAnchoring,
    retentionTagEnforcement: {
      retentionTag: retentionTag.retentionTag,
      complianceProfile: [...AUDITSCRAPBOOK_COMPLIANCE_PROFILE],
      retentionDays: retentionTag.retentionDays,
      retainedUntil: retentionTag.retainedUntil,
      retentionState: retentionTag.retentionState,
      reason: retentionTag.reason,
    },
    consentRedactionLog: {
      consentMode: 'public-source-basis',
      explicitConsentRequired: false,
      policyVersion: '1.0.0',
      recordedAt: generatedAt,
      redactedFields: redactionInfo.redactedFields,
      redactionPolicy: 'minimum-necessary',
      redactionDigest: redactionInfo.redactionDigest,
    },
    legalMetadataMapping: {
      ...buildLegalMetadataMapping(),
    },
  };
}
