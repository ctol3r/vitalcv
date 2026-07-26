/**
 * Pure assembly + helpers for EvidenceCollection. No I/O, deterministic given
 * inputs (no Date.now()).
 */

import { CANONICAL_SOURCE_COVERAGE_STATES } from '@vitalcv/trust-state';
import type {
  EvidenceClass,
  EvidenceCollection,
  EvidenceObject,
  EvidenceRelationship,
  EvidenceStatus,
} from './types';

export const EVIDENCE_CLASSES: readonly EvidenceClass[] = [
  'identity',
  'licensure',
  'board_cert',
  'registration',
  'exclusion',
  'enrollment',
  'privilege',
  'peer_review',
  'recognition',
  'acceptance',
  'start',
  'employment',
  'research',
  'publication',
  'training',
];

/** The status vocabulary, sourced from trust-state so it can never drift. */
export const EVIDENCE_STATUSES: readonly EvidenceStatus[] = CANONICAL_SOURCE_COVERAGE_STATES;

/** Only 'checked' is decision-grade — identical rule to the issuer truth contract. */
export function isDecisionGradeStatus(status: EvidenceStatus): boolean {
  return status === 'checked';
}

function emptyByClass(): Record<EvidenceClass, EvidenceObject[]> {
  const out = {} as Record<EvidenceClass, EvidenceObject[]>;
  for (const cls of EVIDENCE_CLASSES) {
    out[cls] = [];
  }
  return out;
}

function emptyCoverageSummary(): Record<EvidenceStatus, string[]> {
  const out = {} as Record<EvidenceStatus, string[]>;
  for (const state of EVIDENCE_STATUSES) {
    out[state] = [];
  }
  return out;
}

/** Group sourceIds by status (parallels summarizeCanonicalSourceCoverage). */
export function summarizeEvidenceCoverage(
  objects: readonly EvidenceObject[],
): Record<EvidenceStatus, string[]> {
  const summary = emptyCoverageSummary();
  for (const obj of objects) {
    const bucket = summary[obj.status];
    if (bucket && !bucket.includes(obj.source.sourceId)) {
      bucket.push(obj.source.sourceId);
    }
  }
  return summary;
}

export interface BuildEvidenceCollectionInput {
  subjectKey: string;
  generatedFor: { displayName: string; npi: string | null };
  objects: EvidenceObject[];
  relationships?: EvidenceRelationship[];
}

/**
 * Assembles the collection: validates the decisionGrade invariant, groups by
 * class, and summarizes coverage. Throws if any object claims decision-grade
 * while its status is not 'checked' (fail closed — never ship a fake positive).
 */
export function buildEvidenceCollection(
  input: BuildEvidenceCollectionInput,
): EvidenceCollection {
  const byClass = emptyByClass();

  for (const obj of input.objects) {
    if (obj.decisionGrade !== isDecisionGradeStatus(obj.status)) {
      throw new Error(
        `EvidenceObject ${obj.evidenceId} violates decisionGrade invariant: ` +
          `decisionGrade=${obj.decisionGrade} but status=${obj.status}.`,
      );
    }
    byClass[obj.evidenceClass].push(obj);
  }

  return {
    subjectKey: input.subjectKey,
    generatedFor: input.generatedFor,
    objects: input.objects,
    relationships: input.relationships ?? [],
    byClass,
    coverageSummary: summarizeEvidenceCoverage(input.objects),
  };
}
