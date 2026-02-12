import { hashStablePayload } from './hash';
import type { CandidateCredential, ClinicianIdentity, IngestConflictRecord } from './models';

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isPresent(value: unknown): boolean {
  return normalize(value).length > 0;
}

function stateSetFromIdentity(identity: ClinicianIdentity): Set<string> {
  const states = identity.licenses
    .map((license) => normalize(license.state))
    .filter((state) => state.length > 0 && state !== 'unknown');
  return new Set(states);
}

function stateSetFromResume(credentials: readonly CandidateCredential[]): Set<string> {
  const states = credentials
    .flatMap((credential) => credential.licenses.map((license) => normalize(license.state)))
    .filter((state) => state.length > 0 && state !== 'unknown');
  return new Set(states);
}

function hasSpecialtyMismatch(
  identity: ClinicianIdentity,
  credentials: readonly CandidateCredential[],
): boolean {
  const taxonomy = identity.taxonomy.map((entry) => normalize(entry)).filter((entry) => entry.length > 0);
  if (taxonomy.length === 0) return false;

  const resumeCorpus = normalize(
    credentials
      .flatMap((credential) => [
        ...credential.training,
        ...credential.education,
        ...credential.licensure_mentions,
      ])
      .join(' '),
  );

  if (!resumeCorpus) return false;
  return !taxonomy.some((entry) => resumeCorpus.includes(entry));
}

function buildConflict(input: {
  clinician_id: string;
  conflict_type: IngestConflictRecord['conflict_type'];
  npi: unknown;
  resume: unknown;
  detected_at: string;
}): IngestConflictRecord {
  const conflict_id = `conflict:${hashStablePayload({
    clinician_id: input.clinician_id,
    conflict_type: input.conflict_type,
    npi: input.npi,
    resume: input.resume,
  }).slice(0, 18)}`;

  return Object.freeze({
    conflict_id,
    clinician_id: input.clinician_id,
    conflict_type: input.conflict_type,
    sources: Object.freeze({
      left: 'NPI',
      right: 'RESUME',
    }),
    values: Object.freeze({
      npi: input.npi,
      resume: input.resume,
    }),
    status: 'UNRESOLVED',
    detected_at: input.detected_at,
  });
}

export function detectIntakeConflicts(input: {
  clinician_id: string;
  identity: ClinicianIdentity | null;
  credentials: readonly CandidateCredential[];
  detected_at?: string;
}): readonly IngestConflictRecord[] {
  if (input.credentials.length === 0) {
    return Object.freeze([]);
  }

  const detected_at = input.detected_at ?? new Date().toISOString();
  const conflicts: IngestConflictRecord[] = [];

  if (!input.identity) {
    const resumeNameHints = [
      ...new Set(
        input.credentials
          .map((credential) => credential.name_hint)
          .filter((value): value is string => isPresent(value)),
      ),
    ];
    const resumeStates = [...stateSetFromResume(input.credentials)].sort((left, right) =>
      left.localeCompare(right),
    );

    conflicts.push(
      buildConflict({
        clinician_id: input.clinician_id,
        conflict_type: 'NAME_MISMATCH',
        npi: 'MISSING_NPI_IDENTITY',
        resume: {
          name_hints: resumeNameHints,
          license_states: resumeStates,
        },
        detected_at,
      }),
    );

    return Object.freeze(
      conflicts.sort((left, right) => left.conflict_id.localeCompare(right.conflict_id)),
    );
  }

  const expectedName = `${input.identity.first_name} ${input.identity.last_name}`.trim();
  const resumeNameHints = [
    ...new Set(
      input.credentials
        .map((credential) => credential.name_hint)
        .filter((value): value is string => isPresent(value)),
    ),
  ];

  if (
    expectedName.length > 0 &&
    resumeNameHints.length > 0 &&
    !resumeNameHints.some((hint) => normalize(hint) === normalize(expectedName))
  ) {
    conflicts.push(
      buildConflict({
        clinician_id: input.clinician_id,
        conflict_type: 'NAME_MISMATCH',
        npi: expectedName,
        resume: resumeNameHints,
        detected_at,
      }),
    );
  }

  const npiStates = stateSetFromIdentity(input.identity);
  const resumeStates = stateSetFromResume(input.credentials);
  if (
    npiStates.size > 0 &&
    resumeStates.size > 0 &&
    [...resumeStates].some((state) => !npiStates.has(state))
  ) {
    conflicts.push(
      buildConflict({
        clinician_id: input.clinician_id,
        conflict_type: 'STATE_LICENSE_MISMATCH',
        npi: [...npiStates].sort((left, right) => left.localeCompare(right)),
        resume: [...resumeStates].sort((left, right) => left.localeCompare(right)),
        detected_at,
      }),
    );
  }

  if (hasSpecialtyMismatch(input.identity, input.credentials)) {
    conflicts.push(
      buildConflict({
        clinician_id: input.clinician_id,
        conflict_type: 'SPECIALTY_MISMATCH',
        npi: input.identity.taxonomy,
        resume: input.credentials.flatMap((credential) => credential.training),
        detected_at,
      }),
    );
  }

  return Object.freeze(
    conflicts.sort((left, right) => left.conflict_id.localeCompare(right.conflict_id)),
  );
}
