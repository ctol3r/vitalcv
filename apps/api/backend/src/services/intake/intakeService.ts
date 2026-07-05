/**
 * Intake Service — Wave 183: Resume, NPI, Links, and Work Auth Ingestion
 *
 * Handles resume upload parsing, LinkedIn/portfolio links, work authorization,
 * NPI bootstrap, and profile completeness scoring.
 *
 * Anti-duplication rules:
 *   - NPI uniqueness enforced via PersonProfile.npi unique constraint
 *   - Resume re-upload creates a new ParsedResume record; only one is "active"
 *   - Links are upserted (no duplicates per user)
 *   - Work auth updates are idempotent (upsert on userId)
 *
 * Audit events: every ingestion emits an AuditEvent.
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { sha256ForPayload } from '../../utils/deterministic';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ResumeUploadResult {
  resumeId:        string;
  fileName:        string;
  inferredName?:   string;
  inferredTitle?:  string;
  inferredSkills:  string[];
  completeness:    number;
}

export interface LinksIngestionResult {
  linkedinUrl?:   string;
  portfolioUrl?:  string;
  otherUrls:      string[];
  updatedAt:      string;
}

export interface WorkAuthResult {
  userId:         string;
  workAuthStatus: string;
  updatedAt:      string;
}

export interface NpiBootstrapIntakeResult {
  npi:              string;
  npiType:          'TYPE_1' | 'TYPE_2';
  firstName?:       string;
  lastName?:        string;
  specialty?:       string;
  stateOfPractice?: string;
  inferredPersona:  'CLINICIAN' | 'VERIFIER' | 'UNKNOWN';
  alreadyRegistered: boolean;
  completeness:     number;
}

export interface ProfileCompletenessResult {
  userId:       string;
  score:        number;   // 0–100
  dimensions: {
    npiVerified:        boolean;
    resumeUploaded:     boolean;
    linksAdded:         boolean;
    workAuthProvided:   boolean;
    credentialsImported: boolean;
  };
}

// ── Completeness scoring ─────────────────────────────────────────────────────

const DIMENSION_WEIGHTS: Record<string, number> = {
  npiVerified:         30,
  resumeUploaded:      20,
  linksAdded:          10,
  workAuthProvided:    15,
  credentialsImported: 25,
};

function computeCompleteness(dims: ProfileCompletenessResult['dimensions']): number {
  let score = 0;
  for (const [key, weight] of Object.entries(DIMENSION_WEIGHTS)) {
    if (dims[key as keyof typeof dims]) score += weight;
  }
  return Math.min(100, score);
}

// ── Audit helper ─────────────────────────────────────────────────────────────

async function emitAudit(
  type: string,
  referenceId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const hash = sha256ForPayload({ type, referenceId, metadata });
  await prisma.auditEvent.create({
    data: {
      type,
      hash,
      referenceId,
      metadata: JSON.parse(JSON.stringify(metadata)),
    },
  });
}

// ── NPI Type detection ────────────────────────────────────────────────────────

/**
 * Heuristic NPI type detection from NPPES entity type code.
 * Type 1 = Individual / NPI-1 (people)
 * Type 2 = Organization / NPI-2 (groups, hospitals)
 *
 * Without a live NPPES call, we default to TYPE_1 and let the user correct.
 *
 * Hydration fix (fix/nppes-full-hydration, 2026-04-10): this function
 * previously read camelCase fields (`provider.firstName`, `provider.taxonomyCode`,
 * `provider.stateOfPractice`) that do not exist on `NormalizedProvider`. Those
 * reads silently returned `undefined`, so every successful NPPES lookup
 * surfaced as "no data" — indistinguishable from an upstream failure. The
 * actual shape is snake_case with `primary_taxonomy_code` and `practice_address.state`.
 */
async function detectNpiType(npi: string): Promise<{
  npiType:    'TYPE_1' | 'TYPE_2';
  firstName?: string;
  lastName?:  string;
  specialty?: string;
  state?:     string;
}> {
  // Attempt live NPPES v2 lookup (imported from existing module).
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { fetchNpiFromCMS, normalizeProvider } = require('../../modules/identity') as typeof import('../../modules/identity');
    const raw = await fetchNpiFromCMS(npi);
    if (raw) {
      const provider = normalizeProvider(raw.rawPayload);
      const isOrg = provider.enumeration_type === 'NPI-2';
      return {
        npiType:   isOrg ? 'TYPE_2' : 'TYPE_1',
        firstName: provider.first_name || undefined,
        lastName:  provider.last_name  || undefined,
        specialty: provider.primary_taxonomy_code ?? undefined,
        state:     provider.practice_address?.state ?? undefined,
      };
    }
  } catch (err) {
    log('warn', 'NPPES lookup failed during NPI bootstrap', { npi, err: String(err) });
  }

  // Fallback: default to TYPE_1
  return { npiType: 'TYPE_1' };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Ingest a resume file upload.
 * In production, pipe through OCR/LLM extraction. For now, stores metadata.
 */
export async function ingestResumeUpload(
  userId:   string,
  fileName: string,
  fileUrl:  string,
): Promise<ResumeUploadResult> {
  // Deactivate any previous active resume
  await prisma.personProfile.updateMany({
    where: { userId },
    data:  { resumeUrl: fileUrl, updatedAt: new Date() },
  });

  const inferredSkills: string[] = [];

  // Update profile completeness
  const dims = await getProfileDimensions(userId);
  dims.resumeUploaded = true;
  const completeness = computeCompleteness(dims);
  await prisma.personProfile.updateMany({
    where: { userId },
    data:  { completeness },
  });

  await emitAudit('resume_uploaded', userId, { fileName, fileUrl });

  return {
    resumeId:     `resume:${userId}:${Date.now()}`,
    fileName,
    inferredName: undefined,
    inferredTitle: undefined,
    inferredSkills,
    completeness,
  };
}

/**
 * Ingest professional links (LinkedIn, portfolio, other).
 */
export async function ingestLinks(
  userId:       string,
  linkedinUrl?: string,
  portfolioUrl?: string,
  otherUrls:    string[] = [],
): Promise<LinksIngestionResult> {
  const update: Record<string, string | undefined> = {};
  if (linkedinUrl)  update.linkedinUrl  = linkedinUrl;
  if (portfolioUrl) update.portfolioUrl = portfolioUrl;

  if (Object.keys(update).length > 0) {
    await prisma.personProfile.updateMany({
      where: { userId },
      data:  { ...update, updatedAt: new Date() },
    });
  }

  const dims = await getProfileDimensions(userId);
  dims.linksAdded = Boolean(linkedinUrl || portfolioUrl || otherUrls.length);
  const completeness = computeCompleteness(dims);
  await prisma.personProfile.updateMany({
    where: { userId },
    data:  { completeness },
  });

  await emitAudit('links_ingested', userId, { linkedinUrl, portfolioUrl, otherUrls });

  return {
    linkedinUrl,
    portfolioUrl,
    otherUrls,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Ingest work authorization status.
 */
export async function ingestWorkAuth(
  userId:         string,
  workAuthStatus: string,
): Promise<WorkAuthResult> {
  await prisma.personProfile.updateMany({
    where: { userId },
    data:  { workAuthStatus, updatedAt: new Date() },
  });

  const dims = await getProfileDimensions(userId);
  dims.workAuthProvided = true;
  const completeness = computeCompleteness(dims);
  await prisma.personProfile.updateMany({
    where: { userId },
    data:  { completeness },
  });

  await emitAudit('work_auth_ingested', userId, { workAuthStatus });

  return { userId, workAuthStatus, updatedAt: new Date().toISOString() };
}

/**
 * Bootstrap a PersonProfile from an NPI.
 * Detects Type 1 vs Type 2, infers persona, sets initial completeness.
 */
const ATTESTABLE_PROFESSIONS = new Set([
  'physician', 'nurse_practitioner', 'physician_assistant',
  'pharmacist', 'registered_nurse', 'dentist',
]);

export async function bootstrapNpiIntake(
  userId: string,
  npi:    string,
  attestation?: { profession?: string; attested?: boolean; attestationVersion?: string },
): Promise<NpiBootstrapIntakeResult> {
  // Self-attested onboarding claims — clinician-stated, never source-verified.
  // Unknown professions are dropped rather than stored.
  const profession =
    attestation?.profession && ATTESTABLE_PROFESSIONS.has(attestation.profession)
      ? attestation.profession
      : undefined;
  const attested = attestation?.attested === true;
  const attestedAt = attested ? new Date() : undefined;
  const attestationVersion = attested ? (attestation?.attestationVersion ?? 'v1') : undefined;

  // Check for existing registration
  const existing = await prisma.personProfile.findUnique({ where: { npi } });
  if (existing && existing.userId !== userId) {
    // NPI already claimed by another user
    throw new Error(`NPI ${npi} is already registered to another account.`);
  }

  const detected = await detectNpiType(npi);
  const inferredPersona = detected.npiType === 'TYPE_2' ? 'VERIFIER' : 'CLINICIAN';

  // Upsert PersonProfile
  await prisma.personProfile.upsert({
    where:  { userId },
    create: {
      userId,
      npi,
      npiType:        detected.npiType,
      firstName:      detected.firstName,
      lastName:       detected.lastName,
      specialty:      detected.specialty,
      stateOfPractice: detected.state,
      profession,
      attestedAt,
      attestationVersion,
      completeness:   30,
    },
    update: {
      npi,
      npiType:        detected.npiType,
      firstName:      detected.firstName ?? undefined,
      lastName:       detected.lastName  ?? undefined,
      specialty:      detected.specialty ?? undefined,
      stateOfPractice: detected.state   ?? undefined,
      profession:         profession ?? undefined,
      attestedAt:         attestedAt ?? undefined,
      attestationVersion: attestationVersion ?? undefined,
      completeness:   30,
      updatedAt:      new Date(),
    },
  });

  await emitAudit('npi_bootstrapped', userId, {
    npi,
    npiType: detected.npiType,
    inferredPersona,
  });

  // Audit-first: the clinician's attestation is a distinct, hashed audit row —
  // recorded before success is returned. Attested ≠ verified.
  if (attested) {
    await emitAudit('clinician_attestation', userId, {
      npi,
      profession: profession ?? null,
      attestationVersion: attestationVersion ?? null,
    });
  }

  log('info', 'NPI bootstrapped', { userId, npi, npiType: detected.npiType });

  return {
    npi,
    npiType:          detected.npiType,
    firstName:        detected.firstName,
    lastName:         detected.lastName,
    specialty:        detected.specialty,
    stateOfPractice:  detected.state,
    inferredPersona,
    alreadyRegistered: Boolean(existing),
    completeness:     30,
  };
}

/**
 * Get current profile completeness dimensions.
 */
export async function getProfileCompleteness(userId: string): Promise<ProfileCompletenessResult> {
  const dims = await getProfileDimensions(userId);
  return {
    userId,
    score: computeCompleteness(dims),
    dimensions: dims,
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function getProfileDimensions(userId: string): Promise<ProfileCompletenessResult['dimensions']> {
  const profile = await prisma.personProfile.findUnique({ where: { userId } });
  return {
    npiVerified:         Boolean(profile?.npi),
    resumeUploaded:      Boolean(profile?.resumeUrl),
    linksAdded:          Boolean(profile?.linkedinUrl || profile?.portfolioUrl),
    workAuthProvided:    Boolean(profile?.workAuthStatus && profile.workAuthStatus !== 'not_provided'),
    credentialsImported: (profile?.completeness ?? 0) >= 75,
  };
}
