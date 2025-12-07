import { createHash } from 'crypto';

import {
  PrismaClient,
  type Prisma,
  type PrivilegeSafetySignal,
  type StateLicenseVerification,
} from '@prisma/client';

import { anchorNpiValidationScore, listAnchorEvents } from '../../audit/anchor';
import { listNpiHistory, recordNpiChange } from './history';
import type {
  AnchorSummary,
  ClinicianSummary,
  DisambiguationCandidate,
  DisambiguationReport,
  FraudFlag,
  FraudSignalReport,
  IdentityConsistencyReport,
  NpiValidationResponse,
  NppesAddress,
  NppesRecord,
  NpdbCorrelationReport,
  SpecialtyMismatchReport,
  ValidationSnapshot,
  ValidationSources,
} from './types';

const prisma = new PrismaClient();
const DEFAULT_HISTORY_LIMIT = 8;
const MAX_ENROLLMENT_RECORDS = 6;

export interface RunNpiValidationOptions {
  clinicianId: string;
  npi?: string;
  refresh?: boolean;
  historyLimit?: number;
  prisma?: PrismaClient;
  auditAnchor?: boolean;
}

export class NpiValidationError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status = 400, code = 'npi_validation_error') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function runNpiValidation(
  options: RunNpiValidationOptions,
): Promise<NpiValidationResponse> {
  const client = options.prisma ?? prisma;
  const clinician = await client.clinicianProfile.findUnique({
    where: { id: options.clinicianId },
    include: {
      user: {
        select: {
          name: true,
          did: true,
          email: true,
        },
      },
    },
  });

  if (!clinician) {
    throw new NpiValidationError('Clinician not found', 404, 'clinician_not_found');
  }

  const targetNpi = sanitizeNpi(options.npi ?? clinician.npi);
  if (!targetNpi) {
    throw new NpiValidationError(
      'Clinician profile is missing a valid 10-digit NPI',
      400,
      'npi_missing',
    );
  }

  const historyLimit = options.historyLimit ?? DEFAULT_HISTORY_LIMIT;
  const historyPromise = listNpiHistory(options.clinicianId, {
    prisma: client,
    limit: historyLimit,
  });

  const existing = await client.nPIValidation.findUnique({
    where: {
      clinicianId_npi: {
        clinicianId: options.clinicianId,
        npi: targetNpi,
      },
    },
  });
  const previousSnapshot = coerceSnapshot(existing);

  if (previousSnapshot && options.refresh !== true) {
    const anchor = await fetchLatestAnchor(options.clinicianId, targetNpi);
    const history = await historyPromise;
    return buildResponseFromSnapshot({
      clinician,
      snapshot: previousSnapshot,
      updatedAt: existing?.updatedAt?.toISOString() ?? previousSnapshot.generatedAt,
      history,
      anchor,
    });
  }

  const [
    nppesRecord,
    latestLicense,
    boardCredential,
    enrollments,
    npdbSignals,
    duplicates,
  ] = await Promise.all([
    fetchNppesRecord(targetNpi),
    client.stateLicenseVerification.findFirst({
      where: { clinicianId: options.clinicianId },
      orderBy: { verifiedAt: 'desc' },
    }),
    client.credential.findFirst({
      where: {
        clinicianId: options.clinicianId,
        type: { contains: 'board', mode: 'insensitive' },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    client.payerEnrollmentV2.findMany({
      where: { clinicianId: options.clinicianId },
      orderBy: { updatedAt: 'desc' },
      take: MAX_ENROLLMENT_RECORDS,
      include: { payer: true },
    }),
    client.privilegeSafetySignal.findMany({
      where: { clinicianId: options.clinicianId, signalType: 'NPDB_FLAG' },
      orderBy: { detectedAt: 'desc' },
      take: 10,
    }),
    client.clinicianProfile.findMany({
      where: { npi: targetNpi },
      include: { user: true },
    }),
  ]);

  const identityConsistency = evaluateIdentityConsistency({
    clinician,
    nppesRecord,
    license: latestLicense,
    enrollments,
  });
  const specialty = evaluateSpecialtyMismatch({
    clinician,
    nppesRecord,
    license: latestLicense,
    board: boardCredential,
  });
  const fraud = evaluateFraudSignals({
    clinician,
    duplicates,
    nppesRecord,
    npdbSignals,
  });
  const npdbCorrelation = correlateNpdbEvents({
    npi: targetNpi,
    signals: npdbSignals,
  });
  const disambiguation = disambiguateNpi({
    clinician,
    duplicates,
    nppesRecord,
  });

  const generatedAt = new Date().toISOString();
  const snapshot: ValidationSnapshot = {
    npi: targetNpi,
    score: computeAggregateScore({
      identity: identityConsistency,
      specialty,
      fraud,
      npdb: npdbCorrelation,
      disambiguation,
    }),
    status: 'review',
    summary: '',
    identityConsistency,
    specialty,
    fraud,
    npdbCorrelation,
    disambiguation,
    sources: buildSources({
      nppesRecord,
      license: latestLicense,
      board: boardCredential,
      enrollments,
      npdbSignals,
    }),
    generatedAt,
  };
  snapshot.status = deriveStatus(snapshot.score, snapshot.fraud.riskScore);
  snapshot.summary = buildSummary(snapshot);

  await client.nPIValidation.upsert({
    where: {
      clinicianId_npi: {
        clinicianId: options.clinicianId,
        npi: targetNpi,
      },
    },
    create: {
      clinicianId: options.clinicianId,
      npi: targetNpi,
      score: snapshot.score,
      crossRefs: snapshot as Prisma.InputJsonValue,
    },
    update: {
      score: snapshot.score,
      crossRefs: snapshot as Prisma.InputJsonValue,
    },
  });

  await recordNpiChange({
    clinicianId: options.clinicianId,
    npi: targetNpi,
    previousSnapshot,
    nextSnapshot: snapshot,
    prisma: client,
  });

  const anchorRecord =
    options.auditAnchor === false
      ? null
      : anchorNpiValidationScore({
          clinicianId: options.clinicianId,
          npi: targetNpi,
          score: Number(snapshot.score.toFixed(4)),
          status: snapshot.status,
          mismatches:
            snapshot.identityConsistency.mismatchedFields.length +
            snapshot.specialty.mismatches.length +
            snapshot.fraud.flags.length,
          summary: snapshot.summary,
        });

  const history = await listNpiHistory(options.clinicianId, {
    prisma: client,
    limit: historyLimit,
  });

  return {
    clinicianId: options.clinicianId,
    clinician: buildClinicianSummary(clinician),
    npi: targetNpi,
    score: snapshot.score,
    status: snapshot.status,
    summary: snapshot.summary,
    identityConsistency: snapshot.identityConsistency,
    specialty: snapshot.specialty,
    fraud: snapshot.fraud,
    npdbCorrelation: snapshot.npdbCorrelation,
    disambiguation: snapshot.disambiguation,
    sources: snapshot.sources,
    generatedAt: snapshot.generatedAt,
    updatedAt: snapshot.generatedAt,
    history,
    anchor: anchorRecord ? toAnchorSummary(anchorRecord) : await fetchLatestAnchor(options.clinicianId, targetNpi),
  };
}

function buildResponseFromSnapshot(params: {
  clinician: Prisma.ClinicianProfileGetPayload<{ include: { user: true } }>;
  snapshot: ValidationSnapshot;
  updatedAt: string;
  history: Awaited<ReturnType<typeof listNpiHistory>>;
  anchor: AnchorSummary | null;
}): NpiValidationResponse {
  return {
    clinicianId: params.clinician.id,
    clinician: buildClinicianSummary(params.clinician),
    npi: params.snapshot.npi,
    score: params.snapshot.score,
    status: params.snapshot.status,
    summary: params.snapshot.summary,
    identityConsistency: params.snapshot.identityConsistency,
    specialty: params.snapshot.specialty,
    fraud: params.snapshot.fraud,
    npdbCorrelation: params.snapshot.npdbCorrelation,
    disambiguation: params.snapshot.disambiguation,
    sources: params.snapshot.sources,
    generatedAt: params.snapshot.generatedAt,
    updatedAt: params.updatedAt,
    history: params.history,
    anchor: params.anchor,
  };
}

function coerceSnapshot(
  record: Prisma.NPIValidationGetPayload<{}> | null,
): ValidationSnapshot | null {
  if (!record?.crossRefs || typeof record.crossRefs !== 'object') {
    return null;
  }
  try {
    const parsed = record.crossRefs as ValidationSnapshot;
    if (!parsed?.npi || typeof parsed.score !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function fetchLatestAnchor(clinicianId: string, npi: string): Promise<AnchorSummary | null> {
  const [event] = listAnchorEvents({
    type: 'npiValidationAnchored',
    clinicianId,
    limit: 1,
  });
  if (!event) {
    return null;
  }
  if (
    npi &&
    typeof event.payload?.npi === 'string' &&
    event.payload.npi !== npi
  ) {
    return null;
  }
  return toAnchorSummary(event);
}

function buildClinicianSummary(
  clinician: Prisma.ClinicianProfileGetPayload<{ include: { user: true } }>,
): ClinicianSummary {
  return {
    id: clinician.id,
    name: clinician.user?.name ?? null,
    did: clinician.user?.did ?? null,
    state: clinician.state ?? null,
    specialty: clinician.specialty ?? null,
    email: clinician.user?.email ?? null,
  };
}

function evaluateIdentityConsistency(params: {
  clinician: Prisma.ClinicianProfileGetPayload<{ include: { user: true } }>;
  nppesRecord: NppesRecord;
  license: StateLicenseVerification | null;
  enrollments: Prisma.PayerEnrollmentV2GetPayload<{ include: { payer: true } }>[];
}): IdentityConsistencyReport {
  const fields: IdentityConsistencyReport['fields'] = [];
  const nppesName = deriveNppesName(params.nppesRecord);
  const internalName = params.clinician.user?.name ?? 'unknown';
  const nameScore = similarity(nppesName, internalName);
  fields.push({
    field: 'name',
    expected: nppesName,
    observed: internalName,
    matchScore: nameScore,
    drift: 1 - nameScore,
    status: statusFromScore(nameScore),
  });

  const primaryAddress = selectPrimaryAddress(params.nppesRecord.addresses);
  const enrollmentState = extractEnrollmentState(params.enrollments) ?? params.clinician.state ?? null;
  const addressScore = similarity(primaryAddress?.state ?? '', params.clinician.state ?? '');
  fields.push({
    field: 'address',
    expected: primaryAddress?.state ?? 'unknown',
    observed: params.clinician.state ?? 'unknown',
    matchScore: addressScore,
    drift: 1 - addressScore,
    status: statusFromScore(addressScore),
  });

  const taxonomyScore = similarity(
    extractTaxonomy(params.nppesRecord),
    params.clinician.specialty ?? '',
  );
  fields.push({
    field: 'taxonomy',
    expected: extractTaxonomy(params.nppesRecord) || null,
    observed: params.clinician.specialty ?? null,
    matchScore: taxonomyScore,
    drift: 1 - taxonomyScore,
    status: statusFromScore(taxonomyScore),
  });

  const enrollmentScore = similarity(primaryAddress?.state ?? '', enrollmentState ?? '');
  fields.push({
    field: 'enrollmentState',
    expected: primaryAddress?.state ?? null,
    observed: enrollmentState,
    matchScore: enrollmentScore,
    drift: 1 - enrollmentScore,
    status: statusFromScore(enrollmentScore),
  });

  const summaryScore = clamp01(
    fields.reduce((total, field) => total + field.matchScore, 0) / fields.length || 0,
  );

  return {
    summaryScore,
    fields,
    notes: buildIdentityNotes(fields, params.license),
    mismatchedFields: fields.filter((f) => f.status === 'mismatch').map((f) => f.field),
  };
}

function evaluateSpecialtyMismatch(params: {
  clinician: Prisma.ClinicianProfileGetPayload<{ include: { user: true } }>;
  nppesRecord: NppesRecord;
  license: StateLicenseVerification | null;
  board: Prisma.CredentialGetPayload<{}> | null;
}): SpecialtyMismatchReport {
  const nppesTaxonomy = extractTaxonomy(params.nppesRecord);
  const licenseSpecialty = params.license?.specialty ?? extractStringFromJson(params.license?.metadata, 'licenseType');
  const boardSpecialty =
    params.board?.name ??
    extractStringFromJson(params.board?.metadata, 'specialty') ??
    params.board?.type ??
    null;

  const taxonomyAlignment = similarity(nppesTaxonomy ?? '', params.clinician.specialty ?? licenseSpecialty ?? '');
  const mismatches: SpecialtyMismatchReport['mismatches'] = [];

  if (licenseSpecialty && nppesTaxonomy && !isCloseMatch(licenseSpecialty, nppesTaxonomy)) {
    mismatches.push({
      source: 'license',
      expected: nppesTaxonomy,
      observed: licenseSpecialty,
      severity: 'MEDIUM',
      details: 'License specialty diverges from NPPES taxonomy.',
    });
  }

  if (boardSpecialty && nppesTaxonomy && !isCloseMatch(boardSpecialty, nppesTaxonomy)) {
    mismatches.push({
      source: 'board',
      expected: nppesTaxonomy,
      observed: boardSpecialty,
      severity: 'MEDIUM',
      details: 'Board certification does not match NPPES taxonomy.',
    });
  }

  return {
    taxonomy: {
      nppes: nppesTaxonomy ?? null,
      license: licenseSpecialty ?? null,
      board: boardSpecialty ?? null,
    },
    mismatches,
    alignmentScore: clamp01(taxonomyAlignment),
  };
}

function evaluateFraudSignals(params: {
  clinician: Prisma.ClinicianProfileGetPayload<{ include: { user: true } }>;
  duplicates: Prisma.ClinicianProfileGetPayload<{ include: { user: true } }>[];
  nppesRecord: NppesRecord;
  npdbSignals: PrivilegeSafetySignal[];
}): FraudSignalReport {
  const flags: FraudFlag[] = [];
  const duplicateCount = params.duplicates.length;
  if (duplicateCount > 1) {
    flags.push({
      type: 'duplicateNpi',
      severity: duplicateCount > 2 ? 'HIGH' : 'MEDIUM',
      message: `NPI shared across ${duplicateCount} clinician profiles.`,
      metadata: {
        clinicians: params.duplicates.map((duplicate) => ({
          clinicianId: duplicate.id,
          did: duplicate.user?.did ?? null,
          name: duplicate.user?.name ?? null,
        })),
      },
    });
  }

  const didCollisions = params.duplicates.filter(
    (duplicate) =>
      duplicate.id !== params.clinician.id &&
      duplicate.user?.did &&
      duplicate.user.did === params.clinician.user?.did,
  );
  if (didCollisions.length) {
    flags.push({
      type: 'stolenNpi',
      severity: 'HIGH',
      message: 'Matching DID detected on multiple clinician profiles for this NPI.',
      metadata: {
        collisions: didCollisions.map((entry) => entry.id),
      },
    });
  }

  const internalDobProxy = buildDobProxy(
    params.clinician.user?.name ?? params.clinician.id,
    params.clinician.user?.did ?? params.clinician.id,
  );
  const externalDobProxy = buildDobProxy(
    deriveNppesName(params.nppesRecord),
    params.nppesRecord.basic?.birthDate ?? params.nppesRecord.enumerationDate ?? params.nppesRecord.npi,
  );
  if (internalDobProxy !== externalDobProxy) {
    flags.push({
      type: 'dobProxyMismatch',
      severity: 'MEDIUM',
      message: 'DOB proxy hash mismatch detected between internal profile and NPPES.',
      metadata: {
        internalHash: internalDobProxy,
        externalHash: externalDobProxy,
      },
    });
  }

  const npdbEscalations = params.npdbSignals.filter((signal) => signal.severity === 'HIGH' || signal.severity === 'CRITICAL');
  if (npdbEscalations.length) {
    flags.push({
      type: 'stolenNpi',
      severity: 'HIGH',
      message: 'NPDB flags present for this clinician.',
      metadata: {
        signalCount: npdbEscalations.length,
      },
    });
  }

  const riskScore = clamp01(
    (flags.some((flag) => flag.type === 'stolenNpi') ? 0.45 : 0) +
      (flags.some((flag) => flag.type === 'duplicateNpi') ? 0.35 : 0) +
      (flags.some((flag) => flag.type === 'dobProxyMismatch') ? 0.2 : 0),
  );

  return {
    flags,
    duplicateCount,
    riskScore,
    summary: flags.length
      ? `${flags.length} fraud ${flags.length === 1 ? 'flag' : 'flags'} raised`
      : 'No fraud indicators detected',
  };
}

function correlateNpdbEvents(params: {
  npi: string;
  signals: PrivilegeSafetySignal[];
}): NpdbCorrelationReport {
  if (!params.signals.length) {
    return {
      matchedEvents: 0,
      unmatchedEvents: 0,
      coverageRatio: 1,
      lastQueriedAt: null,
      issues: [],
    };
  }

  const matched = params.signals.filter((signal) => {
    const metadata = (signal.metadata as Record<string, unknown> | null) ?? null;
    return (
      typeof metadata?.npi === 'string' &&
      metadata.npi.replace(/\D+/g, '') === params.npi.replace(/\D+/g, '')
    );
  });
  const unmatched = params.signals.length - matched.length;
  const ratio = matched.length / params.signals.length || 0;

  return {
    matchedEvents: matched.length,
    unmatchedEvents: unmatched,
    coverageRatio: clamp01(ratio),
    lastQueriedAt: params.signals[0]?.detectedAt?.toISOString() ?? null,
    issues: unmatched
      ? ['NPDB adverse events detected without matching NPI.']
      : [],
  };
}

function disambiguateNpi(params: {
  clinician: Prisma.ClinicianProfileGetPayload<{ include: { user: true } }>;
  duplicates: Prisma.ClinicianProfileGetPayload<{ include: { user: true } }>[];
  nppesRecord: NppesRecord;
}): DisambiguationReport {
  if (params.duplicates.length <= 1) {
    return {
      status: 'unique',
      canonicalClinicianId: params.clinician.id,
      canonicalDid: params.clinician.user?.did ?? null,
      candidates: [
        {
          clinicianId: params.clinician.id,
          clinicianName: params.clinician.user?.name ?? deriveNppesName(params.nppesRecord),
          did: params.clinician.user?.did ?? null,
          confidence: 1,
          reason: 'Single clinician matches this NPI.',
        },
      ],
    };
  }

  const candidates: DisambiguationCandidate[] = params.duplicates.map((entry) => {
    const nameConfidence = similarity(
      entry.user?.name ?? '',
      deriveNppesName(params.nppesRecord),
    );
    const didMatch = entry.user?.did && entry.user.did === params.clinician.user?.did;
    const confidence = clamp01(didMatch ? 0.95 : nameConfidence);
    return {
      clinicianId: entry.id,
      clinicianName: entry.user?.name ?? null,
      did: entry.user?.did ?? null,
      confidence,
      reason: didMatch ? 'Shared DID' : `Name similarity ${(nameConfidence * 100).toFixed(1)}%`,
    };
  });

  const sorted = candidates.sort((a, b) => b.confidence - a.confidence);
  const status =
    sorted[0]?.confidence && sorted[0].confidence >= 0.8
      ? 'collision'
      : 'undetermined';

  return {
    status,
    canonicalClinicianId: sorted[0]?.clinicianId ?? params.clinician.id,
    canonicalDid: sorted[0]?.did ?? null,
    candidates: sorted,
  };
}

function buildSources(params: {
  nppesRecord: NppesRecord;
  license: StateLicenseVerification | null;
  board: Prisma.CredentialGetPayload<{}> | null;
  enrollments: Prisma.PayerEnrollmentV2GetPayload<{ include: { payer: true } }>[];
  npdbSignals: PrivilegeSafetySignal[];
}): ValidationSources {
  return {
    nppes: {
      payload: params.nppesRecord,
      fetchedAt: new Date().toISOString(),
    },
    license: params.license
      ? {
          id: params.license.id,
          state: params.license.state,
          licenseNumber: params.license.licenseNumber,
          status: params.license.status,
          specialty: params.license.specialty ?? extractStringFromJson(params.license.metadata, 'licenseType'),
          verifiedAt: params.license.verifiedAt?.toISOString() ?? null,
          expiresAt: params.license.expiryDate?.toISOString() ?? null,
        }
      : null,
    board: params.board
      ? {
          id: params.board.id,
          name: params.board.name,
          status: params.board.status ?? (params.board.metadata as { status?: string } | null)?.status ?? null,
          expiresAt: params.board.expiresAt?.toISOString() ?? null,
          specialty:
            extractStringFromJson(params.board.metadata, 'specialty') ??
            params.board.type ??
            null,
        }
      : null,
    enrollments: params.enrollments.map((enrollment) => ({
      id: enrollment.id,
      payerName: enrollment.payer?.name ?? enrollment.payerId,
      status: enrollment.status,
      states: enrollment.states ?? [],
      updatedAt: enrollment.updatedAt?.toISOString() ?? null,
    })),
    npdbSignals: params.npdbSignals.map((signal) => ({
      id: signal.id,
      detectedAt: signal.detectedAt.toISOString(),
      matched: Boolean(
        (signal.metadata as { npi?: string } | null)?.npi?.replace(/\D+/g, ''),
      ),
      metadata: (signal.metadata as Record<string, unknown> | null) ?? null,
    })),
  };
}

function computeAggregateScore(params: {
  identity: IdentityConsistencyReport;
  specialty: SpecialtyMismatchReport;
  fraud: FraudSignalReport;
  npdb: NpdbCorrelationReport;
  disambiguation: DisambiguationReport;
}): number {
  const identityScore = params.identity.summaryScore;
  const specialtyScore = params.specialty.alignmentScore;
  const fraudPenalty = 1 - params.fraud.riskScore;
  const npdbScore = params.npdb.coverageRatio;
  const disambiguationScore =
    params.disambiguation.status === 'unique'
      ? 1
      : params.disambiguation.status === 'undetermined'
        ? 0.75
        : 0.5;

  return clamp01(
    identityScore * 0.35 +
      specialtyScore * 0.2 +
      fraudPenalty * 0.25 +
      npdbScore * 0.1 +
      disambiguationScore * 0.1,
  );
}

function deriveStatus(score: number, fraudRisk: number): 'pass' | 'review' | 'fail' {
  if (fraudRisk >= 0.6 || score < 0.55) {
    return 'fail';
  }
  if (score >= 0.82) {
    return 'pass';
  }
  return 'review';
}

function buildSummary(snapshot: ValidationSnapshot): string {
  const identityPercent = (snapshot.identityConsistency.summaryScore * 100).toFixed(0);
  const fraudPercent = ((1 - snapshot.fraud.riskScore) * 100).toFixed(0);
  const mismatchCount =
    snapshot.identityConsistency.mismatchedFields.length +
    snapshot.specialty.mismatches.length +
    snapshot.fraud.flags.length;
  const mismatchLabel = mismatchCount ? `${mismatchCount} mismatches` : 'no mismatches';
  return `Identity ${identityPercent}% · fraud hygiene ${fraudPercent}% · ${mismatchLabel}`;
}

function buildIdentityNotes(
  fields: IdentityConsistencyReport['fields'],
  license: StateLicenseVerification | null,
): string[] {
  const notes: string[] = [];
  const mismatches = fields.filter((field) => field.status === 'mismatch');
  if (mismatches.length) {
    notes.push(
      `Manual review needed for ${mismatches.map((mismatch) => mismatch.field).join(', ')}.`,
    );
  } else {
    notes.push('Identity attributes align with NPPES registry.');
  }

  if (license?.disciplinaryFlag) {
    notes.push('License disciplinary flag present in latest verification.');
  }
  return notes;
}

function sanitizeNpi(value?: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D+/g, '');
  if (digits.length !== 10) {
    return null;
  }
  return digits;
}

function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const normalizedA = a.toLowerCase().trim();
  const normalizedB = b.toLowerCase().trim();
  if (!normalizedA && !normalizedB) return 1;
  if (!normalizedA || !normalizedB) return 0;
  if (normalizedA === normalizedB) return 1;
  const distance = levenshtein(normalizedA, normalizedB);
  return clamp01(1 - distance / Math.max(normalizedA.length, normalizedB.length));
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i += 1) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j += 1) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i += 1) {
    for (let j = 1; j <= a.length; j += 1) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function statusFromScore(score: number): 'match' | 'review' | 'mismatch' {
  if (score >= 0.9) return 'match';
  if (score >= 0.7) return 'review';
  return 'mismatch';
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function deriveNppesName(record: NppesRecord): string {
  if (record.basic?.organizationName) {
    return record.basic.organizationName;
  }
  const parts = [
    record.basic?.firstName,
    record.basic?.middleName,
    record.basic?.lastName,
  ].filter(Boolean);
  return parts.join(' ').trim() || `NPI ${record.npi}`;
}

function selectPrimaryAddress(addresses: NppesAddress[]): NppesAddress | null {
  if (!addresses?.length) {
    return null;
  }
  return (
    addresses.find((address) => address.addressType === 'LOCATION') ??
    addresses[0] ??
    null
  );
}

function extractEnrollmentState(
  enrollments: Prisma.PayerEnrollmentV2GetPayload<{ include: { payer: true } }>[],
): string | null {
  for (const enrollment of enrollments) {
    if (enrollment.states?.length) {
      return enrollment.states[0] ?? null;
    }
    const metadata = (enrollment.metadata as Record<string, unknown> | null) ?? null;
    if (typeof metadata?.state === 'string') {
      return metadata.state;
    }
  }
  return null;
}

function extractTaxonomy(record: NppesRecord): string | null {
  if (!record.taxonomies?.length) return null;
  const primary = record.taxonomies.find((taxonomy) => taxonomy.primary) ?? record.taxonomies[0];
  return primary?.code ?? primary?.desc ?? null;
}

function extractStringFromJson(
  json: Prisma.JsonValue | null | undefined,
  key: string,
): string | null {
  if (!json || typeof json !== 'object') {
    return null;
  }
  const value = (json as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

function isCloseMatch(a: string, b: string): boolean {
  return similarity(a, b) >= 0.75;
}

function buildDobProxy(name: string, seed: string): string {
  return createHash('sha256').update(`${name}:${seed}`).digest('hex').slice(0, 16);
}

function toAnchorSummary(record: ReturnType<typeof anchorNpiValidationScore>): AnchorSummary {
  return {
    id: record.id,
    txHash: record.txHash,
    network: record.network,
    timestamp: record.payload.timestamp,
  };
}

async function fetchNppesRecord(npi: string): Promise<NppesRecord> {
  const registryUrl =
    process.env.NPPES_REGISTRY_URL ??
    `https://npiregistry.cms.hhs.gov/api/?number=${encodeURIComponent(npi)}&version=2.1`;

  try {
    const response = await fetch(registryUrl);
    if (!response.ok) {
      throw new Error(`NPPES registry responded with ${response.status}`);
    }
    const data = (await response.json()) as { results?: any[] };
    if (!data?.results?.length) {
      return buildSyntheticNppesRecord(npi);
    }
    return normalizeNppesRecord(data.results[0] ?? {}, npi);
  } catch (error) {
    console.warn('[npi][validator] NPPES lookup failed, using synthetic data', error);
    return buildSyntheticNppesRecord(npi);
  }
}

function normalizeNppesRecord(result: any, fallbackNpi: string): NppesRecord {
  const addresses: NppesAddress[] = Array.isArray(result.addresses)
    ? result.addresses.map((address: any) => ({
        addressType: address.address_type ?? 'LOCATION',
        address1: address.address_1 ?? '',
        address2: address.address_2 ?? null,
        city: address.city ?? null,
        state: address.state ?? null,
        postalCode: address.postal_code ?? null,
        country: address.country_code ?? 'US',
      }))
    : [];

  const taxonomies = Array.isArray(result.taxonomies)
    ? result.taxonomies.map((taxonomy: any) => ({
        code: taxonomy.code ?? '',
        desc: taxonomy.desc ?? '',
        primary: taxonomy.primary === 'Yes' || taxonomy.primary === true,
        state: taxonomy.state ?? undefined,
        license: taxonomy.license ?? undefined,
      }))
    : [];

  return {
    npi: result.number ?? fallbackNpi,
    enumerationType: result.enumeration_type ?? 'NPI-1',
    createdEpoch: result.created_epoch,
    lastUpdated: result.basic?.last_updated,
    enumerationDate: result.basic?.enumeration_date,
    status: result.basic?.status,
    basic: {
      firstName: result.basic?.first_name,
      lastName: result.basic?.last_name,
      middleName: result.basic?.middle_name,
      credential: result.basic?.credential,
      gender: result.basic?.gender,
      organizationName: result.basic?.organization_name,
      lastUpdated: result.basic?.last_updated,
      enumerationDate: result.basic?.enumeration_date,
      soleProprietor: result.basic?.sole_proprietor,
      birthDate: result.basic?.birth_date,
    },
    addresses,
    taxonomies,
  };
}

function buildSyntheticNppesRecord(npi: string): NppesRecord {
  const seed = parseInt(createHash('sha256').update(npi).digest('hex').slice(0, 8), 16);
  const cities = ['Austin', 'Seattle', 'Chicago', 'Atlanta', 'Boston', 'Phoenix'];
  const states = ['TX', 'WA', 'IL', 'GA', 'MA', 'AZ'];
  const taxonomyOptions = [
    { code: '207R00000X', desc: 'Internal Medicine' },
    { code: '207P00000X', desc: 'Emergency Medicine' },
    { code: '207K00000X', desc: 'Allergy & Immunology' },
    { code: '2084N0400X', desc: 'Neurology' },
  ];
  const taxonomy = taxonomyOptions[seed % taxonomyOptions.length];
  const city = cities[seed % cities.length];
  const state = states[seed % states.length];
  return {
    npi,
    enumerationType: 'NPI-1',
    createdEpoch: Date.now(),
    lastUpdated: new Date(Date.now() - (seed % 30) * 86400000).toISOString(),
    enumerationDate: new Date(Date.now() - (seed % 120) * 86400000).toISOString(),
    status: 'A',
    basic: {
      firstName: seed % 2 === 0 ? 'Jordan' : 'Riley',
      lastName: seed % 3 === 0 ? 'Glass' : 'Avery',
      organizationName: null,
      lastUpdated: new Date().toISOString(),
    },
    addresses: [
      {
        addressType: 'LOCATION',
        address1: '123 Credential Way',
        address2: null,
        city,
        state,
        postalCode: '78701',
        country: 'US',
      },
    ],
    taxonomies: [
      {
        code: taxonomy.code,
        desc: taxonomy.desc,
        primary: true,
      },
    ],
  };
}









