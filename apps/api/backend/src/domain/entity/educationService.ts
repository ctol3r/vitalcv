/**
 * educationService.ts — Education & Training Domain Service
 *
 * Manages VcvEducationRecord: create, upsert from claims, evaluate
 * readiness contribution, and build education summaries for profiles.
 *
 * Wave S4 — Education as first-class domain
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import {
  evaluateEducationReadiness,
  EDUCATION_RECORD_LABELS,
  type EducationReadinessContribution,
} from './contracts';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UpsertEducationRecordInput {
  subjectEntityId:  string;
  institutionEntityId?: string;
  credentialId?:    string;
  recordType:       string;
  degreeOrTitle?:   string;
  specialty?:       string;
  programName?:     string;
  acgmeCode?:       string;
  startYear?:       number;
  endYear?:         number;
  graduationDate?:  Date;
  completed?:       boolean;
  pgLevel?:         string;
  countryCode?:     string;
  accredited?:      boolean;
  verificationLevel?: string;
  sourceData?:      Record<string, unknown>;
  metadata?:        Record<string, unknown>;
}

export interface EducationSummary {
  id:               string;
  recordType:       string;
  typeLabel:        string;
  degreeOrTitle?:   string;
  specialty?:       string;
  programName?:     string;
  institutionName?: string;
  acgmeCode?:       string;
  startYear?:       number;
  endYear?:         number;
  completed:        boolean;
  verificationLevel: string;
  pgLevel?:         string;
}

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Upsert an education record for a subject entity.
 * Matches on subjectId + recordType + (acgmeCode OR programName) to prevent duplicates.
 */
export async function upsertEducationRecord(
  input: UpsertEducationRecordInput,
) {
  const {
    subjectEntityId, institutionEntityId, credentialId,
    recordType, acgmeCode, programName, degreeOrTitle, specialty,
    startYear, endYear, graduationDate, completed, pgLevel,
    countryCode = 'US', accredited, verificationLevel = 'SELF_REPORTED',
    sourceData = {}, metadata = {},
  } = input;

  // Find existing record by subject + type + program identifier
  const existing = await prisma.vcvEducationRecord.findFirst({
    where: {
      subjectId:  subjectEntityId,
      recordType,
      ...(acgmeCode   ? { acgmeCode }   : {}),
      ...(programName ? { programName } : {}),
    },
  });

  const data = {
    subjectId:        subjectEntityId,
    institutionId:    institutionEntityId ?? null,
    credentialId:     credentialId ?? null,
    recordType,
    degreeOrTitle,
    specialty,
    programName,
    acgmeCode,
    startYear,
    endYear,
    graduationDate,
    completed:        completed ?? false,
    pgLevel,
    countryCode,
    accredited:       accredited ?? null,
    verificationLevel: verificationLevel as import('@prisma/client').VcvVerificationLevel,
    sourceData:       sourceData as import('@prisma/client').Prisma.InputJsonValue,
    metadata:         metadata  as import('@prisma/client').Prisma.InputJsonValue,
  };

  if (existing) {
    // Upgrade verification level if higher
    const levelStrength: Record<string, number> = {
      SELF_REPORTED: 0, SOURCE_MATCHED: 1, SOURCE_VERIFIED: 2,
      CRYPTOGRAPHICALLY_SIGNED: 3, BIOMETRICALLY_CONFIRMED: 4,
    };
    const existingStrength = levelStrength[existing.verificationLevel] ?? 0;
    const newStrength      = levelStrength[verificationLevel]          ?? 0;

    const updated = await prisma.vcvEducationRecord.update({
      where: { id: existing.id },
      data: {
        ...data,
        verificationLevel: newStrength >= existingStrength
          ? data.verificationLevel
          : existing.verificationLevel,
      },
    });
    log('info', 'edu_record_updated', { id: updated.id, recordType, subjectEntityId });
    return updated;
  }

  const created = await prisma.vcvEducationRecord.create({ data });
  log('info', 'edu_record_created', { id: created.id, recordType, subjectEntityId });
  return created;
}

/**
 * Get all education records for an entity, formatted as summaries.
 */
export async function getEducationSummaries(subjectEntityId: string): Promise<EducationSummary[]> {
  const records = await prisma.vcvEducationRecord.findMany({
    where:   { subjectId: subjectEntityId },
    include: { institution: true },
    orderBy: [{ endYear: 'desc' }, { startYear: 'desc' }],
  });

  return records.map(r => ({
    id:               r.id,
    recordType:       r.recordType,
    typeLabel:        EDUCATION_RECORD_LABELS[r.recordType as keyof typeof EDUCATION_RECORD_LABELS] ?? r.recordType,
    degreeOrTitle:    r.degreeOrTitle ?? undefined,
    specialty:        r.specialty    ?? undefined,
    programName:      r.programName  ?? undefined,
    institutionName:  r.institution?.displayName ?? undefined,
    acgmeCode:        r.acgmeCode    ?? undefined,
    startYear:        r.startYear    ?? undefined,
    endYear:          r.endYear      ?? undefined,
    completed:        r.completed,
    verificationLevel: r.verificationLevel,
    pgLevel:          r.pgLevel      ?? undefined,
  }));
}

/**
 * Evaluate education readiness for an entity.
 * Returns per-record-type contributions including gap messages.
 */
export async function evaluateEntityEducationReadiness(
  subjectEntityId: string,
): Promise<EducationReadinessContribution[]> {
  const records = await prisma.vcvEducationRecord.findMany({
    where: { subjectId: subjectEntityId },
    select: { recordType: true, completed: true, verificationLevel: true, updatedAt: true },
  });

  return evaluateEducationReadiness(
    records.map(r => ({
      recordType:        r.recordType,
      completed:         r.completed,
      verificationLevel: r.verificationLevel,
      updatedAt:         r.updatedAt,
    })),
  );
}

/**
 * Check whether an entity has a verified degree (required for clinician readiness).
 */
export async function hasVerifiedDegree(subjectEntityId: string): Promise<boolean> {
  const degree = await prisma.vcvEducationRecord.findFirst({
    where: {
      subjectId:  subjectEntityId,
      recordType: { in: ['MEDICAL_DEGREE', 'NURSING_DEGREE', 'ADVANCED_PRACTICE_CERT'] },
      completed:  true,
      verificationLevel: { in: ['SOURCE_VERIFIED', 'CRYPTOGRAPHICALLY_SIGNED'] },
    },
  });
  return !!degree;
}
