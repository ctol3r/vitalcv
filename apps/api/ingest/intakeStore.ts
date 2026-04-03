import { hashStablePayload } from '@vitalcv/ingest';
import type {
  CandidateCredential,
  ClinicianIdentity,
  IngestConflictRecord,
} from '@vitalcv/ingest';

export type IntakeSummary = Readonly<{
  clinician_id: string;
  identities_count: number;
  candidate_credentials_count: number;
  unverified_credentials_count: number;
}>;

type IdempotentResponse = Readonly<{
  audit_ref: string;
  payload: Readonly<Record<string, unknown>>;
}>;

type ClinicianIntakeState = {
  identity: ClinicianIdentity | null;
  credentials: CandidateCredential[];
  conflicts: IngestConflictRecord[];
};

const clinicianIntakeState = new Map<string, ClinicianIntakeState>();
const idempotentResponses = new Map<string, IdempotentResponse>();

function assertClinicianId(clinician_id: unknown): string {
  if (typeof clinician_id !== 'string' || clinician_id.trim().length === 0) {
    throw new Error('clinician_id is required');
  }

  return clinician_id.trim();
}

function getState(clinician_id: string): ClinicianIntakeState {
  const existing = clinicianIntakeState.get(clinician_id);
  if (existing) return existing;

  const created: ClinicianIntakeState = {
    identity: null,
    credentials: [],
    conflicts: [],
  };
  clinicianIntakeState.set(clinician_id, created);
  return created;
}

export function resolveRequestHash(route_key: string, payload: unknown): string {
  return hashStablePayload({
    route_key,
    payload,
  });
}

function idempotencyKey(route_key: string, request_hash: string): string {
  return `${route_key}:${request_hash}`;
}

export function readIdempotentResponse(
  route_key: string,
  request_hash: string,
): IdempotentResponse | null {
  return idempotentResponses.get(idempotencyKey(route_key, request_hash)) ?? null;
}

export function writeIdempotentResponse(
  route_key: string,
  request_hash: string,
  response: IdempotentResponse,
): void {
  idempotentResponses.set(idempotencyKey(route_key, request_hash), response);
}

export function upsertClinicianIdentity(identity: ClinicianIdentity): ClinicianIdentity {
  const clinician_id = assertClinicianId(identity.clinician_id);
  const state = getState(clinician_id);
  state.identity = Object.freeze({ ...identity });
  clinicianIntakeState.set(clinician_id, state);
  return state.identity;
}

export function appendCandidateCredentials(
  clinician_id: string,
  credentials: readonly CandidateCredential[],
): readonly CandidateCredential[] {
  const normalizedClinicianId = assertClinicianId(clinician_id);
  const state = getState(normalizedClinicianId);

  for (const credential of credentials) {
    const exists = state.credentials.some(
      (existing) => existing.candidate_credential_id === credential.candidate_credential_id,
    );
    if (!exists) {
      state.credentials.push(credential);
    }
  }

  const sorted = [...state.credentials].sort((left, right) =>
    left.candidate_credential_id.localeCompare(right.candidate_credential_id),
  );
  state.credentials = sorted;
  clinicianIntakeState.set(normalizedClinicianId, state);
  return Object.freeze(sorted);
}

export function setIntakeConflicts(
  clinician_id: string,
  conflicts: readonly IngestConflictRecord[],
): readonly IngestConflictRecord[] {
  const normalizedClinicianId = assertClinicianId(clinician_id);
  const state = getState(normalizedClinicianId);
  state.conflicts = [...conflicts].sort((left, right) =>
    left.conflict_id.localeCompare(right.conflict_id),
  );
  clinicianIntakeState.set(normalizedClinicianId, state);
  return Object.freeze([...state.conflicts]);
}

export function listIntakeConflicts(clinician_id: string): readonly IngestConflictRecord[] {
  const normalizedClinicianId = assertClinicianId(clinician_id);
  const state = getState(normalizedClinicianId);
  return Object.freeze([...state.conflicts]);
}

export function hasUnresolvedIntakeConflicts(clinician_id: string): boolean {
  return listIntakeConflicts(clinician_id).some((conflict) => conflict.status === 'UNRESOLVED');
}

export function listCandidateCredentials(clinician_id: string): readonly CandidateCredential[] {
  const normalizedClinicianId = assertClinicianId(clinician_id);
  const state = getState(normalizedClinicianId);
  return Object.freeze([...state.credentials]);
}

export function getClinicianIdentity(clinician_id: string): ClinicianIdentity | null {
  const normalizedClinicianId = assertClinicianId(clinician_id);
  return getState(normalizedClinicianId).identity;
}

export function getIntakeSummary(clinician_id: string): IntakeSummary {
  const normalizedClinicianId = assertClinicianId(clinician_id);
  const state = getState(normalizedClinicianId);

  const unverified_credentials_count = state.credentials.filter(
    (credential) => credential.status === 'UNVERIFIED',
  ).length;

  return Object.freeze({
    clinician_id: normalizedClinicianId,
    identities_count: state.identity ? 1 : 0,
    candidate_credentials_count: state.credentials.length,
    unverified_credentials_count,
  });
}

export function hasIntakeData(clinician_id: string): boolean {
  const summary = getIntakeSummary(clinician_id);
  return summary.identities_count > 0 || summary.candidate_credentials_count > 0;
}

export function resetIntakeStore(): void {
  clinicianIntakeState.clear();
  idempotentResponses.clear();
}
