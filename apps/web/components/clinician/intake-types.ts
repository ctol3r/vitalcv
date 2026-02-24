/**
 * Shared types and helpers for the onboarding intake flow.
 * Extracted from IntakeContent.tsx — all shapes match the backend exactly.
 */

import type { CredentialCandidate as CandidateCredentialApi } from '@vitalcv/shared/credentials';
import type { TrustStateResponse } from '@/components/trust-state/types';

/* ------------------------------------------------------------------ */
/*  State & Data Types                                                 */
/* ------------------------------------------------------------------ */

/** Shared async-data state for every section. */
export type DataState = 'idle' | 'loading' | 'success' | 'error';

/** NPI identity result — shape determined by the backend. */
export type NpiIdentityResult = Record<string, unknown>;

/** Single extracted field returned from document ingestion. */
export type ExtractedField = {
  label: string;
  value: string | null;
  source: string | null;
};

/** Verification lane identifier. */
export type VerificationLane = 'public' | 'partner' | 'manual';

/** Client-tracked verification request record. */
export type VerificationRequestRecord = {
  lane: VerificationLane;
  subject: string;
  status: 'PENDING' | 'COMPLETE' | 'FAILED';
  timestamp: string;
};

/** Manual verification request record (employer/CVO upload). */
export type ManualVerificationRecord = {
  id: number;
  subject: string;
  attestor: string;
  status: 'PENDING' | 'COMPLETE' | 'FAILED';
  timestamp: string;
  reason?: string;
};

/* ------------------------------------------------------------------ */
/*  Locked Copy — exact strings, do not modify                         */
/* ------------------------------------------------------------------ */

export const LABELS = {
  UNVERIFIED: 'Unverified data',
  PENDING: 'Pending verification',
  ADDITIONAL_CHECKS: 'Additional checks required to start',
  START_READY_CLARIFICATION:
    'PSV complete. Employer acceptance and start attestation still required.',
} as const;

export const BLOCKING_EXPLANATIONS: Record<string, string> = {
  MISSING_PSV: 'Credentials have not been independently confirmed through a primary source yet.',
  EXPIRED_PSV: 'A credential verification on file has expired and needs to be renewed.',
  REVOKED_PSV: 'A previously valid credential verification has been revoked.',
  IDENTITY_CONFLICT: 'Identity conflict detected between NPI and uploaded resume data.',
  MISSING_ACCEPTANCE: 'No employer has reviewed and accepted credentials yet.',
  CRS_BELOW_THRESHOLD:
    'Overall credential readiness is below the minimum required to begin clinical work.',
  START_ALREADY_ATTESTED: 'A start date has already been recorded.',
  MISSING_RECOGNITION: 'Not yet recognized by the verification network.',
  NO_ACTIVE_LICENSE: 'No active professional license was found on record.',
  ACTIVE_SANCTIONS: 'There are active sanctions or disciplinary actions on record.',
  VERIFICATION_EXPIRED: 'Credential verification has expired and needs to be refreshed.',
};

/* ------------------------------------------------------------------ */
/*  Verification Lane Config                                           */
/* ------------------------------------------------------------------ */

export const LANE_CONFIG: Record<
  VerificationLane,
  { label: string; subject: string; description: string }
> = {
  public: {
    label: 'Run Public Checks',
    subject: 'NPI confirmation, sanctions',
    description: 'Confirms NPI registry status and screens against sanctions lists.',
  },
  partner: {
    label: 'Request Partner Check',
    subject: 'FCVS / ABMS',
    description: 'Requests credential verification through FCVS or ABMS. (Not yet connected.)',
  },
  manual: {
    label: 'Upload Manual Verification',
    subject: 'CVO / employer doc',
    description: 'Records a manually submitted CVO letter or employer verification document.',
  },
};

export const LANE_ORDER: VerificationLane[] = ['public', 'partner', 'manual'];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export function bandColors(band: string) {
  switch (band) {
    case 'GREEN':
      return {
        bg: 'bg-[var(--trust-green)]/10',
        text: 'text-[var(--trust-green)]',
        border: 'border-[var(--trust-green)]/20',
        dot: 'bg-[var(--trust-green)]',
        stripe: 'border-l-[var(--trust-green)]',
        label: 'CRS threshold met (employer action required)',
      };
    case 'YELLOW':
      return {
        bg: 'bg-[var(--trust-yellow)]/10',
        text: 'text-[var(--trust-yellow)]',
        border: 'border-[var(--trust-yellow)]/20',
        dot: 'bg-[var(--trust-yellow)]',
        stripe: 'border-l-[var(--trust-yellow)]',
        label: 'Needs Attention',
      };
    default:
      return {
        bg: 'bg-[var(--trust-red)]/10',
        text: 'text-[var(--trust-red)]',
        border: 'border-[var(--trust-red)]/20',
        dot: 'bg-[var(--trust-red)]',
        stripe: 'border-l-[var(--trust-red)]',
        label: 'Action Required',
      };
  }
}

export function toExtractedFields(credentials: CandidateCredentialApi[]): ExtractedField[] {
  if (!Array.isArray(credentials) || credentials.length === 0) {
    return [];
  }

  const all = credentials[0];
  const licenses = Array.isArray(all.licenses) ? all.licenses : [];
  const licenseValue =
    licenses.length > 0
      ? licenses
          .map((entry) => `${entry.state}${entry.number ? ` #${entry.number}` : ''}`)
          .join(', ')
      : null;

  const toValue = (value: unknown) =>
    Array.isArray(value) && value.length > 0
      ? value.map((entry) => String(entry)).join('; ')
      : null;

  return [
    { label: 'Education', value: toValue(all.education), source: 'resume_upload' },
    { label: 'Training', value: toValue(all.training), source: 'resume_upload' },
    { label: 'Licensure mentions', value: toValue(all.licensure_mentions), source: 'resume_upload' },
    { label: 'Licenses (multiple supported)', value: licenseValue, source: 'resume_upload' },
    { label: 'Employment timeline', value: toValue(all.employment_timeline), source: 'resume_upload' },
  ];
}

export async function readFileAsBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let idx = 0; idx < bytes.length; idx += 1) {
    binary += String.fromCharCode(bytes[idx]);
  }
  return btoa(binary);
}

export function receiptHash(lane: string, subject: string, timestamp: string): string {
  const input = `${lane}:${subject}:${timestamp}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0').substring(0, 8);
}

export function formatDisplayValue(key: string, value: unknown): string {
  if (Array.isArray(value)) {
    if (key.toLowerCase().includes('license')) {
      return value
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return String(entry);
          const record = entry as Record<string, unknown>;
          const state = typeof record.state === 'string' ? record.state : 'UNKNOWN';
          const number = typeof record.number === 'string' ? ` #${record.number}` : '';
          const source = typeof record.source === 'string' ? ` (${record.source})` : '';
          return `${state}${number}${source}`;
        })
        .join(', ');
    }
    return value.map((entry) => String(entry)).join(', ');
  }
  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value ?? '—');
}
