/**
 * education + training record layer
 *
 * Companion to the existing free-text `education` / `training` arrays on
 * `CandidateCredential`. This module produces structured records that match
 * the upcoming `education` and `training` tables:
 *
 *   education(provider_id, institution, degree, year, confidence)
 *   training(provider_id, program, specialty, year, confidence)
 *
 * The module is intentionally framework-free: no DB driver, no React. The
 * record shape is the contract — storage adapters and UI renderers consume
 * it independently.
 */

import type {
  EducationRecord,
  EducationTrainingProvenance,
  TrainingRecord,
} from './models';

/**
 * Default confidence scores by provenance. These are deliberately low for
 * `inferred` records — the inference rules below are heuristics, not
 * primary-source verification, and the UI should reflect that.
 */
export const EDUCATION_TRAINING_CONFIDENCE: Readonly<Record<EducationTrainingProvenance, number>> =
  Object.freeze({
    extracted: 0.85,
    inferred: 0.6,
    verified: 1.0,
  });

/**
 * The canonical label for the program inferred from a PA-C credential.
 * Exposed so callers (and tests) can assert against the exact string.
 */
export const PA_C_INFERRED_PROGRAM = 'Accredited PA Program';
export const PA_C_INFERRED_SPECIALTY = 'Physician Assistant';

const PA_C_PATTERNS: readonly RegExp[] = [
  /\bPA[-\s.]?C\b/i,
  /\bphysician\s+assistant\b/i,
];

/**
 * Common abbreviations seen on resumes / NPPES taxonomy strings.
 * Expanded during institution normalization.
 */
const INSTITUTION_ABBREVIATIONS: Readonly<Record<string, string>> = Object.freeze({
  u: 'University',
  univ: 'University',
  med: 'Medical',
  ctr: 'Center',
  sch: 'School',
  col: 'College',
  inst: 'Institute',
  hosp: 'Hospital',
});

/**
 * Words that should not be title-cased when they appear mid-name.
 * (e.g. "University of Texas" — "of" stays lowercase).
 */
const SMALL_WORDS = new Set(['of', 'the', 'and', 'at', 'in', 'for']);

/**
 * Normalize an institution name into a canonical, display-ready form.
 *
 * Rules:
 *   - collapse whitespace, strip surrounding punctuation
 *   - expand common abbreviations ("U.", "Univ.", "Med.", etc.)
 *   - title-case the result, leaving small connector words lowercase
 *
 * Pure function — no I/O. Returns an empty string for blank input so callers
 * can use `normalizeInstitution(x) || fallback`.
 */
export function normalizeInstitution(input: string): string {
  if (typeof input !== 'string') return '';
  const collapsed = input
    .replace(/[\s\u00A0]+/g, ' ')
    .replace(/^[\s.,;:'"-]+|[\s.,;:'"-]+$/g, '')
    .trim();
  if (collapsed.length === 0) return '';

  const words = collapsed.split(' ');
  const expanded = words.map((rawWord) => {
    const trimmed = rawWord.replace(/[.,;:]+$/g, '');
    const key = trimmed.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(INSTITUTION_ABBREVIATIONS, key)) {
      return INSTITUTION_ABBREVIATIONS[key];
    }
    return trimmed;
  });

  return expanded
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && SMALL_WORDS.has(lower)) return lower;
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Test whether a free-text credential mention represents a PA-C credential.
 * Matches "PA-C", "PA C", "PAC.", "Physician Assistant", etc.
 */
export function isPaCCredential(value: string): boolean {
  if (typeof value !== 'string') return false;
  return PA_C_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Inference rules: derive training records from facts we already know
 * about the provider (credential strings, license types, etc.).
 *
 * Currently implemented:
 *   - If any input string matches PA-C → emit an "Accredited PA Program"
 *     training record. Rationale: NCCPA certification is contingent on
 *     graduating from an ARC-PA accredited PA program, so the inference
 *     is sound from a single PA-C signal.
 *
 * Returns at most one record per inference rule per provider — duplicates
 * are deduped by program name.
 */
export function inferTrainingFromCredentials(input: {
  providerId: string;
  credentialMentions: readonly string[];
}): readonly TrainingRecord[] {
  const records: TrainingRecord[] = [];
  const seenPrograms = new Set<string>();

  const hasPaC = input.credentialMentions.some(isPaCCredential);
  if (hasPaC && !seenPrograms.has(PA_C_INFERRED_PROGRAM)) {
    seenPrograms.add(PA_C_INFERRED_PROGRAM);
    records.push(
      Object.freeze({
        provider_id: input.providerId,
        program: PA_C_INFERRED_PROGRAM,
        specialty: PA_C_INFERRED_SPECIALTY,
        confidence: EDUCATION_TRAINING_CONFIDENCE.inferred,
        provenance: 'inferred' as const,
      }),
    );
  }

  return Object.freeze(records);
}

/**
 * Build an EducationRecord from raw extracted fields. Centralized so
 * confidence + normalization stay in one place.
 */
export function buildEducationRecord(input: {
  providerId: string;
  institution: string;
  degree: string;
  year?: number;
  provenance?: EducationTrainingProvenance;
}): EducationRecord {
  const provenance: EducationTrainingProvenance = input.provenance ?? 'extracted';
  return Object.freeze({
    provider_id: input.providerId,
    institution: normalizeInstitution(input.institution),
    degree: input.degree.trim(),
    ...(typeof input.year === 'number' && Number.isFinite(input.year)
      ? { year: input.year }
      : {}),
    confidence: EDUCATION_TRAINING_CONFIDENCE[provenance],
    provenance,
  });
}

/**
 * Render a training record list as the canonical display block:
 *
 *   Training:
 *   - Accredited PA Program
 *   - Family Medicine Residency
 *
 * Used by the provider profile UI and by tests that assert exact output.
 * Returns "Training:\n  (none)" for an empty list.
 */
export function formatTrainingDisplay(records: readonly TrainingRecord[]): string {
  if (records.length === 0) {
    return 'Training:\n  (none)';
  }
  const lines = records.map((record) => `- ${record.program}`);
  return ['Training:', ...lines].join('\n');
}
