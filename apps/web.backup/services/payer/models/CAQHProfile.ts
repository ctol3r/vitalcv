/**
 * B169C-PAYER-001: CAQHProfile model
 *
 * Provides typed access to the JSON payload that we persist for CAQH snapshots.
 * The stored `fields` column keeps the subset of CAQH data that powers enrollment
 * prefill + requirement evaluation (specialties, education, malpractice coverage,
 * practice locations, and verified licenses).
 */

import { z } from 'zod';
import type { CaqhProfile } from '../caqhClient.js';

const isoDate = () =>
  z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected ISO date (YYYY-MM-DD)'));

const LicenseSchema = z.object({
  licenseNumber: z.string().min(1),
  state: z.string().min(2),
  licenseType: z.string().min(1),
  issueDate: isoDate(),
  expirationDate: isoDate(),
  status: z.enum(['Active', 'Inactive', 'Expired']),
});

const BoardCertificationSchema = z.object({
  board: z.string().min(1),
  specialty: z.string().min(1),
  certificationNumber: z.string().min(1),
  issueDate: isoDate(),
  expirationDate: isoDate(),
  status: z.enum(['Active', 'Expired']),
});

const SpecialtySchema = z.object({
  taxonomyCode: z.string().min(3),
  specialty: z.string().min(1),
  boardCertified: z.boolean().default(false),
  certificationNumber: z.string().optional(),
  certifyingBoard: z.string().optional(),
  expiresAt: isoDate().optional(),
});

const EducationSchema = z.object({
  degree: z.string().min(2),
  school: z.string().min(2),
  graduationDate: isoDate(),
  specialty: z.string().optional(),
});

const MalpracticeSchema = z.object({
  carrier: z.string().min(1),
  policyNumber: z.string().min(1),
  coverageAmount: z.number().nonnegative(),
  expirationDate: isoDate(),
  perOccurrence: z.number().nonnegative().optional(),
  aggregate: z.number().nonnegative().optional(),
});

const PracticeLocationSchema = z.object({
  name: z.string().min(1),
  taxonomyCode: z.string().optional(),
  phone: z.string().optional(),
  fax: z.string().optional(),
  startDate: isoDate().optional(),
  endDate: isoDate().optional(),
  address: z.object({
    line1: z.string().optional().default(''),
    line2: z.string().optional(),
    city: z.string().optional().default(''),
    state: z
      .union([z.string().regex(/^[A-Za-z]{2}$/, 'State must be two characters'), z.literal('')])
      .optional()
      .default(''),
    postalCode: z.string().optional().default(''),
    country: z.string().optional().default('US'),
  }),
});

export const CaqhProfileFieldsSchema = z.object({
  caqhId: z.string().min(1),
  clinicianId: z.string().min(1),
  status: z.string().min(1),
  attestationDate: isoDate().optional(),
  expirationDate: isoDate().optional(),
  lastUpdatedAt: isoDate().optional(),
  lastSyncedAt: isoDate().optional(),
  licenses: z.array(LicenseSchema).default([]),
  boardCertifications: z.array(BoardCertificationSchema).default([]),
  specialties: z.array(SpecialtySchema).default([]),
  education: z.array(EducationSchema).default([]),
  malpractice: z.union([MalpracticeSchema, z.null()]).optional().default(null),
  practiceLocations: z.array(PracticeLocationSchema).default([]),
});

export type CaqhLicenseFields = z.infer<typeof LicenseSchema>;
export type CaqhBoardCertificationFields = z.infer<typeof BoardCertificationSchema>;
export type CaqhSpecialtyFields = z.infer<typeof SpecialtySchema>;
export type CaqhEducationFields = z.infer<typeof EducationSchema>;
export type CaqhPracticeLocationFields = z.infer<typeof PracticeLocationSchema>;
export type CaqhProfileFields = z.infer<typeof CaqhProfileFieldsSchema>;

/**
 * Validates a persisted CAQH fields payload.
 */
export function parseCaqhProfileFields(payload: unknown): CaqhProfileFields {
  return CaqhProfileFieldsSchema.parse(payload ?? {});
}

/**
 * Utility to build a persisted CAQH fields snapshot from the richer CAQH profile object.
 */
export function buildCaqhFieldsFromProfile(
  profile: CaqhProfile,
  clinicianId: string
): CaqhProfileFields {
  const specialtyMap = new Map<string, CaqhSpecialtyFields>();

  for (const cert of profile.profile.boardCertifications ?? []) {
    specialtyMap.set(cert.specialty, {
      taxonomyCode: mapSpecialtyToTaxonomy(cert.specialty),
      specialty: cert.specialty,
      boardCertified: cert.status === 'Active',
      certificationNumber: cert.certificationNumber,
      certifyingBoard: cert.board,
      expiresAt: cert.expirationDate,
    });
  }

  if (specialtyMap.size === 0) {
    for (const edu of profile.profile.education ?? []) {
      if (!edu.specialty) continue;
      specialtyMap.set(edu.specialty, {
        taxonomyCode: mapSpecialtyToTaxonomy(edu.specialty),
        specialty: edu.specialty,
        boardCertified: false,
      });
    }
  }

  return {
    caqhId: profile.caqhId,
    clinicianId,
    status: profile.status,
    attestationDate: profile.attestationDate,
    expirationDate: profile.expirationDate,
    lastUpdatedAt: profile.lastUpdateDate,
    lastSyncedAt: new Date().toISOString(),
    licenses: profile.profile.licenses ?? [],
    boardCertifications: profile.profile.boardCertifications ?? [],
    specialties: Array.from(specialtyMap.values()),
    education: profile.profile.education ?? [],
    malpractice: profile.profile.malpracticeInsurance
      ? {
          carrier: profile.profile.malpracticeInsurance.carrier,
          policyNumber: profile.profile.malpracticeInsurance.policyNumber,
          coverageAmount: profile.profile.malpracticeInsurance.coverageAmount,
          expirationDate: profile.profile.malpracticeInsurance.expirationDate,
        }
      : null,
    practiceLocations:
      profile.profile.workHistory?.map((work) => ({
        name: work.facilityName,
        taxonomyCode: work.position,
        phone: undefined,
        fax: undefined,
        startDate: work.startDate,
        endDate: work.endDate,
        address: {
          line1: '',
          line2: undefined,
          city: '',
          state: '',
          postalCode: '',
          country: 'US',
        },
      })) ?? [],
  };
}

function mapSpecialtyToTaxonomy(specialty: string): string {
  const TAXONOMY_LOOKUP: Record<string, string> = {
    'Internal Medicine': '207R00000X',
    'Family Medicine': '207Q00000X',
    'Emergency Medicine': '207P00000X',
    Pediatrics: '208000000X',
    Cardiology: '207RC0000X',
    'General Practice': '208D00000X',
    Psychiatry: '2084P0800X',
  };

  return TAXONOMY_LOOKUP[specialty] || '207R00000X';
}

/**
 * B169C-PAYER-001: CAQHProfile domain model & helpers
 *
 * Stores a normalized snapshot of CAQH data that powers payer enrollment readiness.
 * The JSON payload includes specialties, education, malpractice coverage, practice
 * locations, and other credentialing signals.
 */

import { z } from 'zod';
import type { CaqhProfile } from '../../payer/caqhClient.js';

export const CAQH_PROFILE_STATUSES = ['Active', 'Inactive', 'Pending', 'Expired'] as const;
export type CaqhProfileStatus = (typeof CAQH_PROFILE_STATUSES)[number];

export const SpecialtyFieldSchema = z.object({
  specialty: z.string(),
  taxonomyCode: z.string(),
  primary: z.boolean().default(false),
  status: z.enum(['Active', 'Inactive', 'Pending']).default('Active'),
  effectiveDate: z.string().optional(),
  lastUpdatedAt: z.string().optional(),
});

export type SpecialtyField = z.infer<typeof SpecialtyFieldSchema>;

export const EducationHistorySchema = z.object({
  degree: z.string(),
  school: z.string(),
  graduationDate: z.string(),
  specialty: z.string().optional(),
});

export type EducationHistory = z.infer<typeof EducationHistorySchema>;

export const LicenseSchema = z.object({
  licenseNumber: z.string(),
  state: z.string(),
  licenseType: z.string(),
  issueDate: z.string(),
  expirationDate: z.string(),
  status: z.enum(['Active', 'Inactive', 'Expired']),
});

export type LicenseField = z.infer<typeof LicenseSchema>;

export const BoardCertificationSchema = z.object({
  board: z.string(),
  specialty: z.string(),
  certificationNumber: z.string(),
  issueDate: z.string(),
  expirationDate: z.string(),
  status: z.enum(['Active', 'Expired']),
});

export type BoardCertificationField = z.infer<typeof BoardCertificationSchema>;

export const MalpracticeSchema = z
  .object({
    carrier: z.string(),
    policyNumber: z.string(),
    coverageAmount: z.number().int().nonnegative(),
    expirationDate: z.string(),
    occurrenceCoverage: z.boolean().optional(),
  })
  .nullable();

export type MalpracticeCoverage = z.infer<typeof MalpracticeSchema>;

export const PracticeLocationSchema = z.object({
  facilityName: z.string(),
  address1: z.string(),
  address2: z.string().optional(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  phoneNumber: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  currentlyPracticing: z.boolean().default(true),
});

export type PracticeLocation = z.infer<typeof PracticeLocationSchema>;

export const CaqhProfileFieldsSchema = z.object({
  clinicianId: z.string().optional(),
  caqhId: z.string(),
  status: z.enum(CAQH_PROFILE_STATUSES).optional().default('Active'),
  attestationDate: z.string().optional(),
  expirationDate: z.string().optional(),
  lastUpdatedAt: z.string().optional(),
  lastSyncedAt: z.string().optional(),
  specialties: z.array(SpecialtyFieldSchema).default([]),
  education: z.array(EducationHistorySchema).default([]),
  licenses: z.array(LicenseSchema).default([]),
  boardCertifications: z.array(BoardCertificationSchema).default([]),
  malpractice: MalpracticeSchema.default(null),
  practiceLocations: z.array(PracticeLocationSchema).default([]),
  metadata: z.record(z.any()).optional(),
});

export type CaqhProfileFields = z.infer<typeof CaqhProfileFieldsSchema>;

export interface CaqhProfileRecord extends CaqhProfileFields {
  id: string;
  clinicianId: string;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MapCaqhProfileFieldsOptions {
  clinicianId?: string | null;
  syncedAt?: Date;
  specialties?: SpecialtyField[];
  practiceLocations?: PracticeLocation[];
  metadata?: Record<string, unknown>;
}

/**
 * Validates & normalizes arbitrary CAQH field payloads.
 */
export function parseCaqhProfileFields(payload: unknown): CaqhProfileFields {
  return CaqhProfileFieldsSchema.parse(payload);
}

/**
 * Ensures JSON stored in the DB conforms to the schema before persisting.
 */
export function serializeCaqhProfileFields(fields: CaqhProfileFields): Record<string, unknown> {
  return CaqhProfileFieldsSchema.parse(fields);
}

/**
 * Maps the live CAQH API payload to the normalized fields we persist.
 */
export function mapCaqhProfileToFields(
  profile: CaqhProfile,
  options: MapCaqhProfileFieldsOptions = {}
): CaqhProfileFields {
  const specialties =
    options.specialties ??
    deriveSpecialties(profile) ??
    [
      {
        specialty: 'General Practice',
        taxonomyCode: '208D00000X',
        primary: true,
        status: 'Active',
        effectiveDate: profile.attestationDate,
        lastUpdatedAt: profile.lastUpdateDate,
      },
    ];

  return {
    clinicianId: options.clinicianId ?? undefined,
    caqhId: profile.caqhId,
    status: profile.status,
    attestationDate: profile.attestationDate,
    expirationDate: profile.expirationDate,
    lastUpdatedAt: profile.lastUpdateDate,
    lastSyncedAt: options.syncedAt?.toISOString(),
    specialties,
    education: profile.profile.education.map((edu) => ({
      degree: edu.degree,
      school: edu.school,
      graduationDate: edu.graduationDate,
      specialty: edu.specialty,
    })),
    licenses: profile.profile.licenses.map((license) => ({
      licenseNumber: license.licenseNumber,
      state: license.state,
      licenseType: license.licenseType,
      issueDate: license.issueDate,
      expirationDate: license.expirationDate,
      status: license.status,
    })),
    boardCertifications: profile.profile.boardCertifications.map((cert) => ({
      board: cert.board,
      specialty: cert.specialty,
      certificationNumber: cert.certificationNumber,
      issueDate: cert.issueDate,
      expirationDate: cert.expirationDate,
      status: cert.status,
    })),
    malpractice: profile.profile.malpracticeInsurance
      ? {
          carrier: profile.profile.malpracticeInsurance.carrier,
          policyNumber: profile.profile.malpracticeInsurance.policyNumber,
          coverageAmount: profile.profile.malpracticeInsurance.coverageAmount,
          expirationDate: profile.profile.malpracticeInsurance.expirationDate,
        }
      : null,
    practiceLocations: options.practiceLocations ?? [],
    metadata: options.metadata,
  };
}

function deriveSpecialties(profile: CaqhProfile): SpecialtyField[] | null {
  if (!profile.profile.boardCertifications.length) {
    return null;
  }

  return profile.profile.boardCertifications.map((cert, index) => ({
    specialty: cert.specialty,
    taxonomyCode: index === 0 ? '207R00000X' : '207Q00000X',
    primary: index === 0,
    status: cert.status === 'Active' ? 'Active' : 'Inactive',
    effectiveDate: cert.issueDate,
    lastUpdatedAt: profile.lastUpdateDate,
  }));
}
/**
 * B169C-PAYER-001: CAQHProfile domain model
 *
 * Normalises CAQH profile payloads into the subset of data we persist:
 * - Specialties (taxonomy + certification context)
 * - Education history
 * - Malpractice insurance snapshot
 * - Practice locations / work history
 *
 * This lightweight representation is stored in `CaqhProfile.fields` so that
 * downstream services (requirements engine, enrollment UI) can reason about
 * licence readiness without needing the full CAQH export.
 */

import { z } from 'zod';
import type { CaqhProfile } from '../caqhClient.js';

export const CaqhLicenseSchema = z.object({
  licenseNumber: z.string(),
  state: z.string().min(2),
  licenseType: z.string(),
  issueDate: z.string(),
  expirationDate: z.string(),
  status: z.enum(['Active', 'Inactive', 'Expired']),
});

export const CaqhSpecialtySchema = z.object({
  taxonomyCode: z.string(),
  specialty: z.string(),
  boardCertified: z.boolean().default(false),
  certificationNumber: z.string().optional(),
  board: z.string().optional(),
  expiresOn: z.string().optional(),
});

export const CaqhEducationSchema = z.object({
  degree: z.string(),
  school: z.string(),
  graduationDate: z.string(),
  specialty: z.string().optional(),
});

export const CaqhPracticeLocationSchema = z.object({
  facilityName: z.string(),
  city: z.string().optional(),
  state: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  position: z.string().optional(),
});

export const CaqhMalpracticeSchema = z.object({
  carrier: z.string(),
  policyNumber: z.string(),
  coverageAmount: z.number(),
  expirationDate: z.string(),
});

export const CaqhProfileFieldsSchema = z.object({
  caqhId: z.string(),
  status: z.string().default('Active'),
  attestationDate: z.string(),
  expirationDate: z.string(),
  lastUpdatedAt: z.string(),
  specialties: z.array(CaqhSpecialtySchema).default([]),
  education: z.array(CaqhEducationSchema).default([]),
  malpractice: CaqhMalpracticeSchema.nullable().optional(),
  practiceLocations: z.array(CaqhPracticeLocationSchema).default([]),
  licenses: z.array(CaqhLicenseSchema).default([]),
  boardCertifications: z
    .array(
      z.object({
        board: z.string(),
        specialty: z.string(),
        certificationNumber: z.string(),
        issueDate: z.string(),
        expirationDate: z.string(),
        status: z.enum(['Active', 'Expired']),
      })
    )
    .default([]),
});

export type CaqhProfileFields = z.infer<typeof CaqhProfileFieldsSchema>;

export interface CaqhProfileRecord {
  id: string;
  clinicianId: string;
  caqhId: string;
  lastSyncedAt: Date | null;
  fields: CaqhProfileFields;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Normalises a full CAQH profile payload into the lean `fields` structure we persist.
 */
export function mapCaqhProfileToFields(profile: CaqhProfile): CaqhProfileFields {
  const specialties = extractSpecialties(profile);
  const practiceLocations = profile.profile.workHistory.map((work) => ({
    facilityName: work.facilityName,
    city: '', // CAQH stub does not include address details
    state: '',
    startDate: work.startDate,
    endDate: work.endDate,
    position: work.position,
  }));

  const fields = {
    caqhId: profile.caqhId,
    status: profile.status,
    attestationDate: profile.attestationDate,
    expirationDate: profile.expirationDate,
    lastUpdatedAt: profile.lastUpdateDate,
    specialties,
    education: profile.profile.education.map((edu) => ({
      degree: edu.degree,
      school: edu.school,
      graduationDate: edu.graduationDate,
      specialty: edu.specialty,
    })),
    malpractice: profile.profile.malpracticeInsurance
      ? {
          carrier: profile.profile.malpracticeInsurance.carrier,
          policyNumber: profile.profile.malpracticeInsurance.policyNumber,
          coverageAmount: profile.profile.malpracticeInsurance.coverageAmount,
          expirationDate: profile.profile.malpracticeInsurance.expirationDate,
        }
      : null,
    practiceLocations,
    licenses: profile.profile.licenses,
    boardCertifications: profile.profile.boardCertifications,
  };

  return CaqhProfileFieldsSchema.parse(fields);
}

export function parseCaqhProfileFields(data: unknown): CaqhProfileFields {
  return CaqhProfileFieldsSchema.parse(data);
}

function extractSpecialties(profile: CaqhProfile) {
  if (profile.profile.boardCertifications.length > 0) {
    return profile.profile.boardCertifications.map((cert) => ({
      taxonomyCode: mapSpecialtyToTaxonomyCode(cert.specialty),
      specialty: cert.specialty,
      boardCertified: cert.status === 'Active',
      certificationNumber: cert.certificationNumber,
      board: cert.board,
      expiresOn: cert.expirationDate,
    }));
  }

  return profile.profile.education
    .filter((edu) => !!edu.specialty)
    .map((edu) => ({
      taxonomyCode: mapSpecialtyToTaxonomyCode(edu.specialty as string),
      specialty: edu.specialty as string,
      boardCertified: false,
    }));
}

// Minimal taxonomy lookup used during normalisation
const SPECIALTY_TAXONOMY: Record<string, string> = {
  'Internal Medicine': '207R00000X',
  'Family Medicine': '207Q00000X',
  'General Practice': '208D00000X',
  'Emergency Medicine': '207P00000X',
  'Pediatrics': '208000000X',
};

function mapSpecialtyToTaxonomyCode(specialtyName: string): string {
  if (SPECIALTY_TAXONOMY[specialtyName]) {
    return SPECIALTY_TAXONOMY[specialtyName];
  }

  const entry = Object.entries(SPECIALTY_TAXONOMY).find(
    ([key]) => key.toLowerCase() === specialtyName.toLowerCase()
  );
  if (entry) {
    return entry[1];
  }

  return '207R00000X'; // Internal Medicine fallback
}

