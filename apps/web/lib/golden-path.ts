import {
  AuthorityAction,
  AuthorityEventType,
  AuthorityKind,
  resolveAuthoritySnapshot,
  type Authority,
  type AuthorityEvent,
  type AuthorityScope,
  type AuthoritySnapshot,
} from '@domain/authority';
import {
  checkCredentialStatus,
  type Credential,
  type RevocationRecord,
  type ValidityResult,
} from '@domain/credentials';
import {
  computeCRS,
  computeReadinessSignal,
  type CRSInput,
  type CRSResult,
  type QiaValidationResult,
  type ReadinessSignal,
} from '@domain/readiness';
import {
  computeTrustGradient,
  createQIA,
  validateQIA,
  type IntentBinding,
  type QualifiedIdentityAssertion,
  type TrustGradient,
} from '@domain/qia';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DEFAULT_FRESHNESS_MAX_AGE_SECONDS = 60 * 60;

export type GoldenPathScenario = 'ready' | 'not-ready';

export interface GoldenPathState {
  readonly now: Date;
  readonly scenario: GoldenPathScenario;
  readonly credential: Credential;
  readonly credentialValidity: ValidityResult;
  readonly authoritySnapshot: AuthoritySnapshot;
  readonly qia: QualifiedIdentityAssertion;
  readonly qiaValidation: QiaValidationResult;
  readonly trustGradient: TrustGradient;
  readonly crs: CRSResult;
  readonly readiness: ReadinessSignal;
}

export function createShareToken(scenario: GoldenPathScenario, now: Date): string {
  return `share_${scenario}_${now.getTime()}`;
}

export function parseShareToken(token: string): { scenario: GoldenPathScenario; now: Date } {
  if (!token) {
    return { scenario: 'ready', now: new Date() };
  }

  const parts = token.split('_');
  if (parts.length >= 3 && parts[0] === 'share') {
    const scenario = parts[1] === 'not-ready' ? 'not-ready' : 'ready';
    const timestamp = Number(parts[2]);
    if (Number.isFinite(timestamp)) {
      return { scenario, now: new Date(timestamp) };
    }
  }

  return { scenario: 'ready', now: new Date() };
}

export function buildGoldenPathState({
  scenario = 'ready',
  now = new Date(),
  holderId,
}: {
  scenario?: GoldenPathScenario;
  now?: Date;
  holderId?: string;
} = {}): GoldenPathState {
  const subjectId = typeof holderId === 'string' && holderId.length > 0 ? holderId : 'did:holder:demo-0001';
  const credentialIssuedAt = new Date(now.getTime() - MS_PER_DAY * 90);
  const credentialExpiresAt =
    scenario === 'not-ready'
      ? new Date(now.getTime() - MS_PER_DAY * 3)
      : new Date(now.getTime() + MS_PER_DAY * 365);

  const credential: Credential = {
    id: `CRED-${now.getFullYear()}-0001`,
    type: ['VitalCredential', 'ClinicianLicense'],
    issuer: 'did:issuer:vitalcv',
    subject: {
      id: subjectId,
      type: 'Clinician',
      claims: {
        full_name: 'Dr. Avery Reed',
        npi: '1234567890',
        specialty: 'Emergency Medicine',
      },
    },
    temporal: {
      issued_at: credentialIssuedAt,
      not_before: credentialIssuedAt,
      expires_at: credentialExpiresAt,
    },
  };

  const revocationRecord: RevocationRecord | null = null;
  const freshnessRequirement = { max_age_seconds: 60 * 60 * 24 * 365 };
  const credentialValidity = checkCredentialStatus(
    credential,
    revocationRecord,
    now,
    freshnessRequirement,
  );

  const authority: Authority = {
    authority_id: 'AUTH-CA-MED-BOARD',
    kind: AuthorityKind.HUMAN,
    label: 'CA Medical Board',
  };

  const scope: AuthorityScope = {
    scope_id: 'SCOPE-CA-LICENSE',
    authority_id: authority.authority_id,
    domain: 'licensure',
    actions: [AuthorityAction.ASSERT],
    subject: {
      id: subjectId,
      type: 'Clinician',
    },
    constraints: {
      state: 'CA',
    },
  };

  const grantEvent: AuthorityEvent = {
    event_id: `AUTH:${authority.authority_id}:${scope.scope_id}:grant`,
    authority_id: authority.authority_id,
    event_type: AuthorityEventType.GRANT,
    occurred_at: new Date(now.getTime() - MS_PER_DAY * 120),
    scope,
    reason: 'Active licensure scope',
  };

  const authoritySnapshot = resolveAuthoritySnapshot(authority, [grantEvent], now);

  const intentIssuedAt = new Date(now.getTime() - 1000 * 60 * 60 * 4);
  const intentExpiresAt = new Date(now.getTime() + MS_PER_DAY * 30);
  const intent: IntentBinding = {
    intent_id: `intent:${subjectId}`,
    purpose: 'employment_verification',
    scope: ['credential:verify', 'license:confirm'],
    audience: ['employer:general-hospital'],
    issued_at: intentIssuedAt,
    expires_at: intentExpiresAt,
  };

  const freshnessProvenAt = new Date(now.getTime() - 1000 * 60 * 15);

  const qia = createQIA({
    qia_id: `QIA-${subjectId}`,
    subject: {
      subject_id: subjectId,
      subject_type: 'Clinician',
    },
    authority: {
      authority_id: authority.authority_id,
      authority_kind: authority.kind,
    },
    intent,
    temporal: {
      issued_at: intentIssuedAt,
      not_before: intentIssuedAt,
      expires_at: intentExpiresAt,
    },
    freshness: {
      proven_at: freshnessProvenAt,
      max_age_seconds: DEFAULT_FRESHNESS_MAX_AGE_SECONDS,
      evidence_refs: ['psv:board-check'],
    },
    credential_refs: [credential.id],
    evidence_refs: ['board:license', 'education:transcript'],
  });

  const qiaValidation: QiaValidationResult = validateQIA(qia, now);

  const freshnessAgeSeconds = Math.max(
    0,
    Math.floor((now.getTime() - freshnessProvenAt.getTime()) / 1000),
  );

  const trustGradient = computeTrustGradient({
    confidence: 0.92,
    freshness_age_seconds: freshnessAgeSeconds,
    freshness_max_age_seconds: DEFAULT_FRESHNESS_MAX_AGE_SECONDS,
    dispute_count: 0,
    corroboration_density: 0.86,
  });

  const crsInput: CRSInput = {
    credentialValidityResult: credentialValidity,
    authorityStateSummary: authoritySnapshot,
    qiaValidationResult: qiaValidation,
    trustGradient,
  };

  const crs = computeCRS(crsInput, now);
  const readiness = computeReadinessSignal(crs);

  return {
    now,
    scenario,
    credential,
    credentialValidity,
    authoritySnapshot,
    qia,
    qiaValidation,
    trustGradient,
    crs,
    readiness,
  };
}
