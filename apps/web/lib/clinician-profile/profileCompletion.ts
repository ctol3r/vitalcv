/**
 * Clinician profile completion helpers.
 *
 * Truth rules:
 *   - "Completion" measures *filled-ness*, not verification.
 *   - Source-backed fields contribute MORE to readiness than
 *     self-attested ones. A profile that is 100% filled but 0%
 *     source-backed is NOT verified.
 *   - Unknown/conflict fields never count toward verified completion.
 *   - Output is shaped for both desktop and mobile dashboard surfaces.
 */

import { PROVENANCE_META } from '@/lib/profile/provenance';
import type {
  ClinicianProfile,
  ProfileCompletionSignal,
  ProfileFieldConfidence,
  ProfileFieldMeta,
  ProfileFieldProvenance,
  ProfileSectionKey,
} from './profileTypes';

const CONFIDENCE_WEIGHT: Record<ProfileFieldConfidence, number> = {
  'source-backed': 1.0,
  'self-attested': 0.4,
  'imported-candidate': 0.3,
  unverified: 0,
};

interface FieldRollup {
  filled: number;
  total: number;
  sourceBacked: number;
  conflicts: number;
  weightedSum: number;
}

function isFilled(meta: ProfileFieldMeta<unknown>): boolean {
  if (meta.value === null || meta.value === undefined) return false;
  if (typeof meta.value === 'string' && meta.value.trim() === '') return false;
  if (Array.isArray(meta.value) && meta.value.length === 0) return false;
  return true;
}

function rollupFields(fields: ProfileFieldMeta<unknown>[]): FieldRollup {
  const acc: FieldRollup = { filled: 0, total: 0, sourceBacked: 0, conflicts: 0, weightedSum: 0 };
  for (const f of fields) {
    acc.total += 1;
    if (f.provenance === 'CONFLICT') acc.conflicts += 1;
    if (isFilled(f)) {
      acc.filled += 1;
      acc.weightedSum += CONFIDENCE_WEIGHT[f.confidence];
      if (f.confidence === 'source-backed') acc.sourceBacked += 1;
    }
  }
  return acc;
}

function buildSignal(
  section: ProfileSectionKey,
  rollup: FieldRollup,
): ProfileCompletionSignal {
  const filledRatio = rollup.total === 0 ? 0 : rollup.filled / rollup.total;
  const sourceBackedRatio = rollup.filled === 0 ? 0 : rollup.sourceBacked / rollup.filled;
  let readinessNote: string;
  if (rollup.total === 0) {
    readinessNote = 'No fields tracked yet for this section.';
  } else if (rollup.filled === 0) {
    readinessNote = 'Section is empty. Filling fields here improves your dashboard view; verification still requires source-backed evidence.';
  } else if (rollup.sourceBacked === 0) {
    readinessNote = 'Section has self-attested or imported entries only. Source-backed evidence has not been attached.';
  } else if (rollup.sourceBacked < rollup.filled) {
    readinessNote = 'Section has a mix of source-backed and self-attested entries. The non-source-backed fields are not verified.';
  } else {
    readinessNote = 'Every filled field in this section is source-backed.';
  }
  if (rollup.conflicts > 0) {
    readinessNote += ` ${rollup.conflicts} unresolved conflict${rollup.conflicts === 1 ? '' : 's'} pending review.`;
  }
  return {
    section,
    filledFieldCount: rollup.filled,
    totalFieldCount: rollup.total,
    sourceBackedFieldCount: rollup.sourceBacked,
    unresolvedConflictCount: rollup.conflicts,
    filledRatio,
    sourceBackedRatio,
    readinessNote,
  };
}

function entryFields<T extends object>(entry: T, keys: (keyof T)[]): ProfileFieldMeta<unknown>[] {
  return keys.map((k) => entry[k] as ProfileFieldMeta<unknown>);
}

/**
 * Returns a per-section signal and an overall composite.
 *
 * The overall signal is the average of:
 *   - filled ratio across all tracked fields
 *   - source-backed share among filled fields, weighted by confidence
 *
 * Important: the composite NEVER reaches 1.0 without source-backed
 * evidence, even if every field is filled.
 */
export function calculateClinicianProfileCompletion(profile: ClinicianProfile): {
  sections: ProfileCompletionSignal[];
  overallFilledRatio: number;
  overallSourceBackedRatio: number;
  overallVerificationReadiness: number;
  overallNote: string;
} {
  const sections: ProfileCompletionSignal[] = [];

  const identityFields = entryFields(profile.identity, [
    'legalName',
    'preferredName',
    'npi',
    'primaryEmail',
    'primaryPhone',
    'practiceLocations',
  ]);
  sections.push(buildSignal('identity', rollupFields(identityFields)));

  const medSchoolEntries = profile.education.filter((e) => e.programType === 'medical_school');
  sections.push(
    buildSignal(
      'medical_school',
      rollupFields(medSchoolEntries.flatMap((e) => entryFields(e, ['institution', 'degree', 'graduationYear']))),
    ),
  );

  const residency = profile.training.filter((t) => t.programType === 'residency');
  const fellowship = profile.training.filter((t) => t.programType === 'fellowship');
  const otherTraining = profile.training.filter(
    (t) => t.programType !== 'residency' && t.programType !== 'fellowship',
  );
  sections.push(
    buildSignal(
      'residency',
      rollupFields(residency.flatMap((t) => entryFields(t, ['institution', 'specialty', 'startYear', 'endYear']))),
    ),
  );
  sections.push(
    buildSignal(
      'fellowship',
      rollupFields(fellowship.flatMap((t) => entryFields(t, ['institution', 'specialty', 'startYear', 'endYear']))),
    ),
  );
  sections.push(
    buildSignal(
      'training_programs',
      rollupFields(otherTraining.flatMap((t) => entryFields(t, ['institution', 'specialty', 'startYear', 'endYear']))),
    ),
  );

  sections.push(
    buildSignal(
      'specialties',
      rollupFields(profile.specialties.flatMap((s) => entryFields(s, ['specialty', 'subspecialty', 'boardCertified']))),
    ),
  );

  const currentEmployerFields = profile.currentEmployer
    ? entryFields(profile.currentEmployer, ['employer', 'title', 'startDate'])
    : [];
  sections.push(buildSignal('current_employer', rollupFields(currentEmployerFields)));

  sections.push(
    buildSignal(
      'employer_history',
      rollupFields(
        profile.employerHistory.flatMap((e) => entryFields(e, ['employer', 'title', 'startDate', 'endDate'])),
      ),
    ),
  );

  sections.push(
    buildSignal(
      'affiliations',
      rollupFields(
        profile.affiliations.flatMap((a) =>
          entryFields(a, ['organization', 'affiliationType', 'startDate', 'endDate']),
        ),
      ),
    ),
  );

  sections.push(
    buildSignal(
      'research',
      rollupFields(profile.research.flatMap((r) => entryFields(r, ['topic', 'role', 'institution']))),
    ),
  );

  sections.push(
    buildSignal(
      'publications',
      rollupFields(profile.publications.flatMap((p) => entryFields(p, ['title', 'journal', 'publishedYear', 'pubmedId']))),
    ),
  );

  sections.push(buildSignal('career_goals', rollupFields([profile.careerGoals])));

  const totalFilled = sections.reduce((s, x) => s + x.filledFieldCount, 0);
  const totalFields = sections.reduce((s, x) => s + x.totalFieldCount, 0);
  const totalSourceBacked = sections.reduce((s, x) => s + x.sourceBackedFieldCount, 0);

  const overallFilledRatio = totalFields === 0 ? 0 : totalFilled / totalFields;
  const overallSourceBackedRatio = totalFilled === 0 ? 0 : totalSourceBacked / totalFilled;
  const overallVerificationReadiness = (overallFilledRatio + overallSourceBackedRatio) / 2;

  const overallNote =
    totalSourceBacked === 0 && totalFilled > 0
      ? 'Profile has self-attested or imported entries only. None of these count as verified credentialing evidence.'
      : totalSourceBacked < totalFilled
        ? 'Profile is partially source-backed. Self-attested fields are not verified.'
        : totalSourceBacked === 0 && totalFilled === 0
          ? 'Profile is empty. Start by adding identity and one credential entry.'
          : 'Every filled field is source-backed. Verification still requires the credentialing reviewer to inspect the receipts.';

  return {
    sections,
    overallFilledRatio,
    overallSourceBackedRatio,
    overallVerificationReadiness,
    overallNote,
  };
}

export function getProfileSectionReadiness(
  profile: ClinicianProfile,
  section: ProfileSectionKey,
): ProfileCompletionSignal | null {
  const summary = calculateClinicianProfileCompletion(profile);
  return summary.sections.find((s) => s.section === section) ?? null;
}

/**
 * Returns the section keys that have either zero filled fields or
 * zero source-backed fields. Used by the dashboard to highlight where
 * the clinician should focus next.
 */
export function getMissingProfileFoundationFields(profile: ClinicianProfile): ProfileSectionKey[] {
  const summary = calculateClinicianProfileCompletion(profile);
  return summary.sections
    .filter((s) => s.totalFieldCount > 0 && (s.filledFieldCount === 0 || s.sourceBackedFieldCount === 0))
    .map((s) => s.section);
}

export function explainProfileFieldProvenance(provenance: ProfileFieldProvenance): string {
  return PROVENANCE_META[provenance].description;
}
