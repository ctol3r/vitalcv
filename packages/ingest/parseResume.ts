import { hashStablePayload } from './hash';
import { parseResume as parseResumeEngine } from './engine';
import type {
  CandidateCredential,
  CandidateCredentialParseSummary,
  LicenseCandidate,
  VerificationStatus,
} from './models';
import { TextDecoder } from 'node:util';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const utf8TextDecoder = new TextDecoder('utf-8', { fatal: true });

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function summarizeFields(input: {
  education: readonly string[];
  training: readonly string[];
  licensure_mentions: readonly string[];
  licenses: readonly LicenseCandidate[];
  employment_timeline: readonly string[];
}): CandidateCredentialParseSummary {
  const found: string[] = [];
  const missing: string[] = [];

  if (input.education.length > 0) found.push('Education');
  else missing.push('Education');

  if (input.training.length > 0) found.push('Training');
  else missing.push('Training');

  if (input.licensure_mentions.length > 0) found.push('Licensure');
  else missing.push('Licensure');

  if (input.licenses.length > 0) found.push('Licenses');
  else missing.push('Licenses');

  if (input.employment_timeline.length > 0) found.push('EmploymentTimeline');
  else missing.push('EmploymentTimeline');

  return Object.freeze({
    fields_found: Object.freeze(found),
    fields_missing: Object.freeze(missing),
  });
}

export class ResumeIngestError extends Error {
  public readonly code: 'UNSUPPORTED_FILE_TYPE' | 'FILE_TOO_LARGE' | 'INVALID_FILE_CONTENT';

  constructor(
    message: string,
    code: 'UNSUPPORTED_FILE_TYPE' | 'FILE_TOO_LARGE' | 'INVALID_FILE_CONTENT',
  ) {
    super(message);
    this.name = 'ResumeIngestError';
    this.code = code;
  }
}

function resolveMimeType(inputMimeType: string, filename: string): string {
  const mimeType = normalizeString(inputMimeType).toLowerCase();
  const normalizedFilename = normalizeString(filename).toLowerCase();

  if (mimeType.length > 0) {
    return mimeType;
  }

  if (normalizedFilename.endsWith('.pdf')) {
    return 'application/pdf';
  }

  if (normalizedFilename.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  return '';
}

export function assertSupportedFile(mime_type: string, filename: string): string {
  const resolved = resolveMimeType(mime_type, filename);
  if (!SUPPORTED_MIME_TYPES.has(resolved)) {
    throw new ResumeIngestError('unsupported file type; only PDF and DOCX are allowed', 'UNSUPPORTED_FILE_TYPE');
  }

  return resolved;
}

function decodeBase64(content_base64: string): Buffer {
  const normalized = content_base64.replace(/\s+/g, '');
  if (normalized.length === 0) {
    throw new ResumeIngestError('file content must be base64 encoded', 'INVALID_FILE_CONTENT');
  }

  const usesBase64UrlAlphabet = /[-_]/.test(normalized);
  const usesBase64Alphabet = /[+/]/.test(normalized);
  if (usesBase64UrlAlphabet && usesBase64Alphabet) {
    throw new ResumeIngestError('file content must use a single base64 alphabet', 'INVALID_FILE_CONTENT');
  }

  const validAlphabet = usesBase64UrlAlphabet
    ? /^[A-Za-z0-9\-_]+=*$/
    : /^[A-Za-z0-9+/]+=*$/;
  if (!validAlphabet.test(normalized) || normalized.slice(0, -2).includes('=')) {
    throw new ResumeIngestError('file content must be base64 encoded', 'INVALID_FILE_CONTENT');
  }

  const standardBase64 = usesBase64UrlAlphabet
    ? normalized.replace(/-/g, '+').replace(/_/g, '/')
    : normalized;
  if (standardBase64.length % 4 === 1) {
    throw new ResumeIngestError('file content must be base64 encoded', 'INVALID_FILE_CONTENT');
  }

  const paddedBase64 = standardBase64.padEnd(
    Math.ceil(standardBase64.length / 4) * 4,
    '=',
  );
  const buffer = Buffer.from(paddedBase64, 'base64');
  const roundTripBase64 = buffer.toString('base64').replace(/=+$/u, '');
  const normalizedInputBase64 = paddedBase64.replace(/=+$/u, '');
  if (roundTripBase64 !== normalizedInputBase64) {
    throw new ResumeIngestError('file content is malformed or truncated', 'INVALID_FILE_CONTENT');
  }

  if (buffer.length === 0) {
    throw new ResumeIngestError('uploaded file is empty', 'INVALID_FILE_CONTENT');
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new ResumeIngestError('file exceeds max size of 10MB', 'FILE_TOO_LARGE');
  }

  return buffer;
}

function decodeUtf8Text(payloadBuffer: Buffer): string {
  try {
    return utf8TextDecoder.decode(payloadBuffer);
  } catch {
    throw new ResumeIngestError(
      'uploaded file must contain valid UTF-8 text',
      'INVALID_FILE_CONTENT',
    );
  }
}

function computeCredentialId(input: {
  clinician_id: string;
  filename: string;
  mime_type: string;
  text_hash: string;
}): string {
  const digest = hashStablePayload(input);
  return `candidate:${digest.slice(0, 16)}`;
}

function assertClinicianId(clinician_id: unknown): string {
  if (typeof clinician_id !== 'string' || clinician_id.trim().length === 0) {
    throw new ResumeIngestError('clinician_id is required', 'INVALID_FILE_CONTENT');
  }

  return clinician_id.trim();
}

export function parseCandidateCredential(input: {
  clinician_id: string;
  filename: string;
  mime_type: string;
  content_base64: string;
  extracted_at?: string;
}): CandidateCredential {
  const clinician_id = assertClinicianId(input.clinician_id);
  const filename = normalizeString(input.filename);
  if (filename.length === 0) {
    throw new ResumeIngestError('filename is required', 'INVALID_FILE_CONTENT');
  }

  const mime_type = assertSupportedFile(input.mime_type, filename);
  const payloadBuffer = decodeBase64(input.content_base64);
  const extracted_at = input.extracted_at ?? new Date().toISOString();
  const rawText = decodeUtf8Text(payloadBuffer);
  const parsedResume = parseResumeEngine({ text: rawText });

  const summary = summarizeFields({
    education: parsedResume.education,
    training: parsedResume.training,
    licensure_mentions: parsedResume.licensure_mentions,
    licenses: parsedResume.licenses,
    employment_timeline: parsedResume.employment_timeline,
  });

  return Object.freeze({
    candidate_credential_id: computeCredentialId({
      clinician_id,
      filename,
      mime_type,
      text_hash: hashStablePayload(parsedResume.normalized_text),
    }),
    clinician_id,
    source: 'resume_upload',
    status: 'UNVERIFIED' as VerificationStatus,
    filename,
    mime_type,
    extracted_at,
    ...(parsedResume.name_hint ? { name_hint: parsedResume.name_hint } : {}),
    education: parsedResume.education,
    training: parsedResume.training,
    licensure_mentions: parsedResume.licensure_mentions,
    licenses: parsedResume.licenses,
    employment_timeline: parsedResume.employment_timeline,
    pre_psv_confidence_score: parsedResume.pre_psv_confidence_score,
    fields_found: summary.fields_found,
    fields_missing: summary.fields_missing,
  });
}

export function summarizeCandidateCredentials(
  credentials: readonly CandidateCredential[],
): CandidateCredentialParseSummary {
  if (!Array.isArray(credentials) || credentials.length === 0) {
    return Object.freeze({
      fields_found: Object.freeze([]),
      fields_missing: Object.freeze([
        'Education',
        'Training',
        'Licensure',
        'Licenses',
        'EmploymentTimeline',
      ]),
    });
  }

  const found = new Set<string>();
  const missing = new Set<string>();

  for (const credential of credentials) {
    credential.fields_found.forEach((value: string) => found.add(value));
    credential.fields_missing.forEach((value: string) => missing.add(value));
  }

  for (const value of found) {
    missing.delete(value);
  }

  return Object.freeze({
    fields_found: Object.freeze([...found].sort((left, right) => left.localeCompare(right))),
    fields_missing: Object.freeze([...missing].sort((left, right) => left.localeCompare(right))),
  });
}

export function maxResumeUploadBytes(): number {
  return MAX_FILE_SIZE_BYTES;
}
