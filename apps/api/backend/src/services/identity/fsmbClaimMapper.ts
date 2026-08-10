import { log } from '../../obs/logger';
import {
  boardOrderSeverityBlocksReadiness,
  boardOrderSeverityRequiresReview,
  buildFsmbContractSnapshot,
  defaultAuthorityTruthFields,
  normalizeBoardOrderSeverity,
  type AuthorityConnectorState,
  type AuthorityParticipationStatus,
  type AuthoritySourceScope,
  type AuthorityTargetDomain,
  type BoardOrderSeverity,
} from '../authority/contracts';
import type {
  AuthorityUnavailableValue,
  BoardCertValue,
  LicenseValue,
  NormalizedClaim,
  TrainingCompletionValue,
} from './evidenceModel';
import { buildClaimArtifactTrace, computeClaimId } from './evidenceModel';
import {
  resolveCertificationStatus,
  resolveLicenseStatus,
  unrecognizedStatusReason,
} from './licenseStatusVocabulary';

export function isFsmbEnabled(): boolean {
  return process.env.FSMB_ENABLED === 'true';
}

interface FsmbDisciplinaryActionRecord {
  description?: string;
  action?: string;
  summary?: string;
  severity?: string;
  level?: string;
  boardOrderSeverity?: string;
  effectiveDate?: string | null;
}

type FsmbDisciplinaryAction = string | FsmbDisciplinaryActionRecord;

interface FsmbLicense {
  state?: string;
  jurisdiction?: string;
  licenseNumber?: string | null;
  status?: string;
  licenseStatus?: string;
  issueDate?: string | null;
  expirationDate?: string | null;
  disciplinaryActions?: FsmbDisciplinaryAction[];
  actions?: FsmbDisciplinaryAction[];
}

interface FsmbCert {
  certifyingBoard?: string;
  specialty?: string;
  certificationStatus?: string;
  issueDate?: string | null;
  expirationDate?: string | null;
}

interface FsmbTraining {
  programName?: string;
  institution?: string;
  institutionName?: string;
  specialty?: string | null;
  trainingType?: string;
  completionDate?: string | null;
  graduationDate?: string | null;
}

interface FsmbDocInfo {
  medicalLicenses?: FsmbLicense[];
  licenses?: FsmbLicense[];
  boardCertifications?: FsmbCert[];
  training?: FsmbTraining[];
  trainingHistory?: FsmbTraining[];
  graduateMedicalEducation?: FsmbTraining[];
}

interface FsmbFetchResult {
  status: 'ok' | 'not_found' | 'unauthorized' | 'unavailable';
  data?: FsmbDocInfo;
  error?: string;
  fetchedAt: string;
}

interface NormalizedDisciplinaryAction {
  description: string;
  severity: BoardOrderSeverity;
  effectiveDate: string | null;
}

async function fetchFsmbDocInfo(npi: string): Promise<FsmbFetchResult> {
  const apiKey = process.env.FSMB_API_KEY?.trim();
  const now = new Date().toISOString();

  if (!apiKey) {
    return {
      status: 'unavailable',
      error: 'FSMB_API_KEY not configured',
      fetchedAt: now,
    };
  }

  const url = `https://docinfo-api.fsmb.org/v1/physicians/${npi}`;
  try {
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (resp.status === 404) {
      return { status: 'not_found', fetchedAt: now };
    }
    if (resp.status === 401 || resp.status === 403) {
      return {
        status: 'unauthorized',
        error: `FSMB auth ${resp.status}`,
        fetchedAt: now,
      };
    }
    if (!resp.ok) {
      return {
        status: 'unavailable',
        error: `FSMB HTTP ${resp.status}`,
        fetchedAt: now,
      };
    }

    return {
      status: 'ok',
      data: await resp.json() as FsmbDocInfo,
      fetchedAt: now,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log('warn', 'fsmb_fetch_failed', { npi, error: message });
    return {
      status: 'unavailable',
      error: message,
      fetchedAt: now,
    };
  }
}

/*
 * `normLicStatus` and `normCertStatus` used to live here. Both matched by
 * substring with the affirmative arm first, which cannot express negation:
 * `'INACTIVE'.includes('ACTIVE')` and `'NOT CERTIFIED'.includes('CERTIFIED')`
 * are both true, so the negative arms beneath them were unreachable dead code.
 * An inactive licence read as ACTIVE, and a physician the board reports as
 * *not* board certified read as CERTIFIED. They are replaced by the exact-key
 * resolvers in `licenseStatusVocabulary.ts`, called directly at the two sites
 * below so there is one obvious path; anything outside the vocabulary fails
 * closed to UNKNOWN and is marked for review.
 */

function inferSeverityFromDescription(description: string): BoardOrderSeverity {
  const normalized = description.trim().toUpperCase();
  if (/(REVOC|TERMINAT|SURRENDER|CEASE|PROHIBIT|LOSS OF LICENSE)/.test(normalized)) {
    return 'CRITICAL';
  }
  if (/(SUSPEND|SUMMARY ACTION|EMERGENC)/.test(normalized)) {
    return 'HIGH';
  }
  if (/(PROBATION|REPRIMAND|FINE|CONSENT ORDER)/.test(normalized)) {
    return 'MEDIUM';
  }
  if (normalized.length > 0) {
    return 'LOW';
  }
  return 'NONE';
}

function normalizeDisciplinaryActions(
  values: FsmbDisciplinaryAction[] | undefined,
): NormalizedDisciplinaryAction[] {
  return (values ?? [])
    .map((value) => {
      if (typeof value === 'string') {
        return {
          description: value,
          severity: inferSeverityFromDescription(value),
          effectiveDate: null,
        };
      }

      const description =
        value.description
        ?? value.action
        ?? value.summary
        ?? 'FSMB board order present';
      const explicitSeverity =
        value.boardOrderSeverity
        ?? value.severity
        ?? value.level;
      const normalizedExplicitSeverity = explicitSeverity
        ? normalizeBoardOrderSeverity(explicitSeverity)
        : 'NONE';

      return {
        description,
        severity:
          normalizedExplicitSeverity !== 'NONE'
            ? normalizedExplicitSeverity
            : inferSeverityFromDescription(description),
        effectiveDate: value.effectiveDate ?? null,
      };
    })
    .filter((action) => action.description.trim().length > 0);
}

function strongestSeverity(
  values: readonly NormalizedDisciplinaryAction[],
): BoardOrderSeverity {
  const ranked: BoardOrderSeverity[] = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  let current: BoardOrderSeverity = 'NONE';
  for (const value of values) {
    if (ranked.indexOf(value.severity) > ranked.indexOf(current)) {
      current = value.severity;
    }
  }
  return current;
}

function baseClaim(
  claimType: NormalizedClaim['claimType'],
  npi: string,
  observedAt: string,
  value: NormalizedClaim['value'],
  overrides: Partial<NormalizedClaim> = {},
): NormalizedClaim {
  const artifactId = overrides.artifactId ?? `fsmb-${claimType.toLowerCase()}-${npi}`;
  const artifactChecksum = overrides.artifactChecksum ?? `fsmb-contract-${npi}`;
  const confidence = overrides.confidence ?? 'HIGH';
  const trace = buildClaimArtifactTrace({
    sourceId: 'FSMB',
    sourceUrl: 'https://docinfo-api.fsmb.org/v1/physicians',
    retrievedAt: overrides.retrieved_at ?? observedAt,
    artifactId,
    checksum: artifactChecksum,
    claimType,
    matchConfidence: overrides.match_confidence ?? confidence,
  });
  return {
    claimId: computeClaimId(claimType, 'FSMB', npi, value),
    claimType,
    sourceId: 'FSMB',
    artifactId,
    artifactChecksum,
    parserVersion: 'fsmb-claim-mapper/v2',
    subjectNpi: npi,
    tier: 'GOLD',
    confidence,
    confidenceScore: 0.95,
    status: 'ACTIVE',
    reviewRequired: false,
    reviewReason: null,
    humanReviewAt: null,
    observedAt,
    derivedAt: observedAt,
    source_id: trace.source_id,
    source_url: trace.source_url,
    retrieved_at: trace.retrieved_at,
    raw_artifact_ref: trace.raw_artifact_ref,
    checksum: trace.checksum,
    claim_type: trace.claim_type,
    match_confidence: trace.match_confidence,
    validFrom: observedAt,
    validUntil: null,
    expiresAt: null,
    supersededBy: null,
    supersedes: null,
    value,
    ...overrides,
  };
}

function unavailableConfidence(
  connectorState: AuthorityConnectorState,
): Pick<NormalizedClaim, 'confidence' | 'confidenceScore'> {
  if (connectorState === 'connected') {
    return {
      confidence: 'MEDIUM',
      confidenceScore: 0.55,
    };
  }

  return {
    confidence: 'LOW',
    confidenceScore: 0.4,
  };
}

function unavailableParticipation(
  connectorState: AuthorityConnectorState,
): AuthorityParticipationStatus {
  if (connectorState === 'configured') return 'configured';
  if (connectorState === 'connected') return 'connected';
  return 'unresolved';
}

function buildUnavailableFsmbClaims(
  npi: string,
  observedAt: string,
  input: {
    reason: string;
    connectorState: AuthorityConnectorState;
    participationStatus?: AuthorityParticipationStatus;
    scopes?: AuthoritySourceScope[];
  },
): NormalizedClaim[] {
  const contract = buildFsmbContractSnapshot();
  const targetScopes = input.scopes ?? contract.scopes.map((scope) => scope.scope);

  return targetScopes
    .map((scopeId) => contract.scopes.find((scope) => scope.scope === scopeId))
    .filter((scope): scope is FsmbContractScope => Boolean(scope))
    .map((scope) => {
      const authorityFields = defaultAuthorityTruthFields({
        authorityClaimCode: 'AUTHORITY_UNAVAILABLE',
        issuerEntityId: contract.issuerEntityId,
        sourceScope: scope.scope,
        effectiveAt: null,
        expiresAt: null,
        verifiedAt: observedAt,
        dataFreshness: 'Freshness unavailable',
        participationStatus:
          input.participationStatus
          ?? unavailableParticipation(input.connectorState),
        boardOrderSeverity: 'NONE',
        connectorState: input.connectorState,
        targetDomain: scope.targetDomain,
      });

      const value: AuthorityUnavailableValue = {
        _type: 'AUTHORITY_UNAVAILABLE',
        reason: input.reason,
        source: 'FSMB',
        targetDomain: scope.targetDomain,
        jurisdiction: null,
        authorityClaimCode: 'AUTHORITY_UNAVAILABLE',
        sourceScope: scope.scope,
        issuerEntityId: authorityFields.issuerEntityId,
        effectiveAt: authorityFields.effectiveAt,
        verifiedAt: authorityFields.verifiedAt,
        confidenceLabel: authorityFields.confidenceLabel,
        dataFreshness: authorityFields.dataFreshness,
        participationStatus: authorityFields.participationStatus,
        boardOrderSeverity: authorityFields.boardOrderSeverity,
        connectorState: authorityFields.connectorState,
      };

      const confidence = unavailableConfidence(input.connectorState);
      return baseClaim('AUTHORITY_UNAVAILABLE', npi, observedAt, value, {
        artifactId: `fsmb-authority-${scope.scope.toLowerCase()}-${npi}`,
        confidence: confidence.confidence,
        confidenceScore: confidence.confidenceScore,
        status: 'UNVERIFIED',
      });
    });
}

function normalizeTrainingType(
  raw?: string,
): TrainingCompletionValue['trainingType'] {
  const value = (raw ?? '').trim().toUpperCase();
  if (value.includes('RESID')) return 'RESIDENCY';
  if (value.includes('FELLOW')) return 'FELLOWSHIP';
  if (value.includes('INTERNSHIP')) return 'INTERNSHIP';
  if (value.includes('CME')) return 'CME';
  return 'OTHER';
}

export interface FsmbClaimSet {
  claims: NormalizedClaim[];
  sourced: boolean;
  fetchedAt: string;
  error?: string;
}

type FsmbContractScope = {
  scope: AuthoritySourceScope;
  state: AuthorityConnectorState;
  targetDomain: AuthorityTargetDomain;
};

export async function fetchFsmbClaims(
  npi: string,
  observedAt: string,
): Promise<FsmbClaimSet> {
  if (!isFsmbEnabled()) {
    return {
      claims: buildUnavailableFsmbClaims(npi, observedAt, {
        reason: 'FSMB integration is not enabled for this environment.',
        connectorState: 'unavailable',
      }),
      sourced: true,
      fetchedAt: observedAt,
      error: 'FSMB not enabled',
    };
  }

  const result = await fetchFsmbDocInfo(npi);
  if (result.status !== 'ok' || !result.data) {
    return {
      claims: buildUnavailableFsmbClaims(npi, result.fetchedAt, {
        reason:
          result.status === 'not_found'
            ? 'FSMB returned no physician authority record for this NPI.'
            : result.error ?? 'FSMB authority data unavailable.',
        connectorState: result.status === 'not_found' ? 'connected' : 'unavailable',
        participationStatus: result.status === 'not_found' ? 'connected' : 'unresolved',
      }),
      sourced: true,
      fetchedAt: result.fetchedAt,
      error: result.error ?? result.status,
    };
  }

  const contract = buildFsmbContractSnapshot();
  const claims: NormalizedClaim[] = [];
  const licenses = result.data.medicalLicenses ?? result.data.licenses ?? [];
  const certs = result.data.boardCertifications ?? [];
  const trainings =
    result.data.training
    ?? result.data.trainingHistory
    ?? result.data.graduateMedicalEducation
    ?? [];

  for (const license of licenses) {
    const state = (license.state ?? license.jurisdiction ?? 'UNKNOWN').trim().toUpperCase();
    const licenseResolution = resolveLicenseStatus(license.status ?? license.licenseStatus);
    const licenseStatus = licenseResolution.status;
    const statusReviewReason = unrecognizedStatusReason(`FSMB (${state})`, licenseResolution);
    const actions = normalizeDisciplinaryActions([
      ...(license.disciplinaryActions ?? []),
      ...(license.actions ?? []),
    ]);
    const topSeverity = strongestSeverity(actions);

    const licenseValue: LicenseValue = {
      _type: 'LICENSE',
      state,
      licenseNumber: license.licenseNumber ?? null,
      issueDate: license.issueDate ?? null,
      expiryDate: license.expirationDate ?? null,
      licenseStatus,
      disciplinaryActions: actions.map((action) => action.description),
      source: 'FSMB',
      authorityClaimCode:
        licenseStatus === 'ACTIVE' ? 'PHYSICIAN_LICENSE_ACTIVE' : undefined,
      sourceScope: 'FSMB_MED_API',
      issuerEntityId: contract.issuerEntityId,
      effectiveAt: license.issueDate ?? result.fetchedAt,
      verifiedAt: result.fetchedAt,
      confidenceLabel: 'Confirmed',
      dataFreshness: 'Updated weekly',
      participationStatus: 'verified_result',
      boardOrderSeverity: topSeverity,
      connectorState: 'connected',
      sourceDisclaimer: 'FSMB-authorized data only. No state board HTML fallback.',
    };

    claims.push(baseClaim('LICENSE', npi, observedAt, licenseValue, {
      artifactId: `fsmb-license-${npi}-${state.toLowerCase()}`,
      status:
        licenseStatus === 'ACTIVE'
          ? 'ACTIVE'
          : licenseStatus === 'EXPIRED'
            ? 'EXPIRED'
            : licenseStatus === 'SUSPENDED' || licenseStatus === 'REVOKED'
              ? 'BLOCKED'
              : 'UNVERIFIED',
      reviewRequired: boardOrderSeverityRequiresReview(topSeverity) || statusReviewReason !== null,
      reviewReason:
        [
          boardOrderSeverityRequiresReview(topSeverity)
            ? `FSMB board order present for ${state}`
            : null,
          statusReviewReason,
        ]
          .filter((reason): reason is string => reason !== null)
          .join(' ') || null,
      validFrom: license.issueDate ?? observedAt,
      validUntil: license.expirationDate ?? null,
      expiresAt: license.expirationDate ?? null,
    }));

    for (const [index, action] of actions.entries()) {
      const disciplineValue: LicenseValue = {
        ...licenseValue,
        disciplinaryActions: [action.description],
        authorityClaimCode: 'BOARD_ORDER_PRESENT',
        sourceScope: 'FSMB_PDC',
        boardOrderSeverity: action.severity,
      };

      claims.push(baseClaim('LICENSE_DISCIPLINE', npi, observedAt, disciplineValue, {
        artifactId: `fsmb-board-order-${npi}-${state.toLowerCase()}-${index}`,
        status: boardOrderSeverityBlocksReadiness(action.severity) ? 'BLOCKED' : 'ACTIVE',
        reviewRequired: boardOrderSeverityRequiresReview(action.severity),
        reviewReason: `Board order: ${action.description}`,
        validFrom: action.effectiveDate ?? license.issueDate ?? observedAt,
        validUntil: license.expirationDate ?? null,
        expiresAt: license.expirationDate ?? null,
      }));
    }
  }

  for (const cert of certs) {
    const certificationStatus = resolveCertificationStatus(cert.certificationStatus).status;
    const certValue: BoardCertValue = {
      _type: 'BOARD_CERTIFICATION',
      certifyingBoard: cert.certifyingBoard ?? 'ABMS member board',
      specialty: cert.specialty ?? 'Unknown specialty',
      certificationDate: cert.issueDate ?? null,
      expiryDate: cert.expirationDate ?? null,
      certificationStatus,
      flagSource: 'ABMS',
      authorityClaimCode:
        certificationStatus === 'CERTIFIED' ? 'BOARD_CERTIFIED' : undefined,
      sourceScope: 'FSMB_ABMS_INCLUDED',
      issuerEntityId: contract.issuerEntityId,
      effectiveAt: cert.issueDate ?? result.fetchedAt,
      verifiedAt: result.fetchedAt,
      confidenceLabel: 'Confirmed',
      dataFreshness: 'Updated weekly',
      participationStatus: 'verified_result',
      boardOrderSeverity: 'NONE',
      connectorState: 'connected',
    };

    claims.push(baseClaim('BOARD_CERTIFICATION', npi, observedAt, certValue, {
      artifactId: `fsmb-cert-${npi}-${certValue.specialty.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      status:
        certificationStatus === 'CERTIFIED'
          ? 'ACTIVE'
          : certificationStatus === 'LAPSED'
            ? 'EXPIRED'
            : 'UNVERIFIED',
      validFrom: cert.issueDate ?? observedAt,
      validUntil: cert.expirationDate ?? null,
      expiresAt: cert.expirationDate ?? null,
    }));
  }

  for (const [index, training] of trainings.entries()) {
    const completionDate = training.completionDate ?? training.graduationDate ?? null;
    if (!completionDate) {
      continue;
    }

    const trainingValue: TrainingCompletionValue = {
      _type: 'TRAINING_COMPLETION',
      programName: training.programName ?? 'Training program',
      institution: training.institution ?? training.institutionName ?? 'Unknown institution',
      specialty: training.specialty ?? null,
      trainingType: normalizeTrainingType(training.trainingType),
      completionDate,
      source: 'FSMB',
      authorityClaimCode: 'TRAINING_COMPLETED',
      sourceScope: 'FSMB_TRAINING',
      issuerEntityId: contract.issuerEntityId,
      effectiveAt: completionDate,
      verifiedAt: result.fetchedAt,
      confidenceLabel: 'Confirmed',
      dataFreshness: 'Updated weekly',
      participationStatus: 'verified_result',
      boardOrderSeverity: 'NONE',
      connectorState: 'connected',
    };

    claims.push(baseClaim('TRAINING_COMPLETION', npi, observedAt, trainingValue, {
      artifactId: `fsmb-training-${npi}-${index}`,
      validFrom: completionDate,
    }));
  }

  if (claims.length === 0) {
    return {
      claims: buildUnavailableFsmbClaims(npi, result.fetchedAt, {
        reason: 'FSMB responded, but no authority data was returned for the configured scopes.',
        connectorState: 'connected',
        participationStatus: 'connected',
      }),
      sourced: true,
      fetchedAt: result.fetchedAt,
    };
  }

  log('info', 'fsmb_claims_mapped', {
    npi,
    licenseCount: licenses.length,
    certCount: certs.length,
    trainingCount: trainings.length,
    claimCount: claims.length,
  });

  return {
    claims,
    sourced: true,
    fetchedAt: result.fetchedAt,
  };
}
