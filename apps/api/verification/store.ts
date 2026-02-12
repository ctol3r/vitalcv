import crypto from 'crypto';
import { PsvStore, type AppendReceiptInput } from '../../../packages/psv';
import type {
  ManualVerificationRequestRecord,
  ManualVerificationSource,
} from './types';

type CreateRequestInput = Readonly<{
  clinician_id: string;
  subject: string;
  source: ManualVerificationSource;
  attestor_id: string;
  document_hash: string;
  created_at?: string;
}>;

type ResolveRequestInput = Readonly<{
  request_id: string;
  receipt_id: string;
  completed_at?: string;
  failure_reason?: string;
}>;

let psvStore = new PsvStore();
const requestById = new Map<string, ManualVerificationRequestRecord>();
const requestIdsByClinician = new Map<string, string[]>();

function assertNonEmpty(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }

  return value.trim();
}

function ensurePending(request: ManualVerificationRequestRecord): void {
  if (request.status !== 'PENDING') {
    throw new Error(`verification request is already completed: ${request.request_id}`);
  }
}

function withUpdatedRequest(
  request_id: string,
  updater: (request: ManualVerificationRequestRecord) => ManualVerificationRequestRecord,
): ManualVerificationRequestRecord {
  const existing = requestById.get(request_id);
  if (!existing) {
    throw new Error(`verification request not found: ${request_id}`);
  }

  const next = Object.freeze(updater(existing));
  requestById.set(request_id, next);
  return next;
}

export function createManualVerificationRequest(input: CreateRequestInput): ManualVerificationRequestRecord {
  const clinician_id = assertNonEmpty(input.clinician_id, 'clinician_id');
  const subject = assertNonEmpty(input.subject, 'subject');
  const attestor_id = assertNonEmpty(input.attestor_id, 'attestor_id');
  const document_hash = assertNonEmpty(input.document_hash, 'document_hash');
  const created_at = input.created_at ?? new Date().toISOString();
  const request_id = crypto.randomUUID();

  const request = Object.freeze({
    request_id,
    clinician_id,
    lane: 'MANUAL' as const,
    subject,
    status: 'PENDING' as const,
    source: input.source,
    attestor_id,
    document_hash,
    created_at,
    completed_at: null,
    receipt_id: null,
    failure_reason: null,
  });

  requestById.set(request_id, request);
  const priorIds = requestIdsByClinician.get(clinician_id) ?? [];
  requestIdsByClinician.set(clinician_id, [...priorIds, request_id]);
  return request;
}

export function completeManualVerificationRequest(
  input: ResolveRequestInput,
): ManualVerificationRequestRecord {
  const request_id = assertNonEmpty(input.request_id, 'request_id');
  const receipt_id = assertNonEmpty(input.receipt_id, 'receipt_id');
  const completed_at = input.completed_at ?? new Date().toISOString();

  return withUpdatedRequest(request_id, (request) => {
    ensurePending(request);
    return {
      ...request,
      status: 'COMPLETE',
      completed_at,
      receipt_id,
      failure_reason: null,
    };
  });
}

export function failManualVerificationRequest(
  input: ResolveRequestInput,
): ManualVerificationRequestRecord {
  const request_id = assertNonEmpty(input.request_id, 'request_id');
  const receipt_id = assertNonEmpty(input.receipt_id, 'receipt_id');
  const completed_at = input.completed_at ?? new Date().toISOString();
  const failure_reason = assertNonEmpty(
    input.failure_reason ?? 'MANUAL_VERIFICATION_FAILED',
    'failure_reason',
  );

  return withUpdatedRequest(request_id, (request) => {
    ensurePending(request);
    return {
      ...request,
      status: 'FAILED',
      completed_at,
      receipt_id,
      failure_reason,
    };
  });
}

export function appendManualVerificationReceipt(input: AppendReceiptInput) {
  return psvStore.append(input);
}

export function listVerificationReceiptsByClinician(clinician_id: string) {
  return psvStore.listByClinician(clinician_id);
}

export function listVerificationReceiptIdsByClinician(clinician_id: string) {
  return psvStore.listReceiptIdsByClinician(clinician_id);
}

export function getManualVerificationRequest(
  request_id: string,
): ManualVerificationRequestRecord | null {
  return requestById.get(request_id) ?? null;
}

export function listManualVerificationRequestsByClinician(
  clinician_id: string,
): readonly ManualVerificationRequestRecord[] {
  const ids = requestIdsByClinician.get(assertNonEmpty(clinician_id, 'clinician_id')) ?? [];
  return Object.freeze(
    ids
      .map((request_id) => requestById.get(request_id))
      .filter((request): request is ManualVerificationRequestRecord => Boolean(request)),
  );
}

export function resetVerificationStore(): void {
  psvStore = new PsvStore();
  requestById.clear();
  requestIdsByClinician.clear();
}

