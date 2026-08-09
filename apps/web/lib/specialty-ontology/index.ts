/**
 * Specialty ontology barrel — reference vocabulary for physician specialties,
 * board certificates, training paths, and the NUCC crosswalk (K1).
 */

export type {
  CertificateLevel,
  IssuingBoard,
  SpecialtyCertificate,
  ResidencyEntryMode,
  ResidencyProgramType,
  NuccMapping,
  NuccCrosswalkEntry,
} from './types';
export { CERTIFICATES } from './certificates';
export { RESIDENCIES } from './residencies';
export { NUCC_CROSSWALK } from './nuccCrosswalk';

import { CERTIFICATES } from './certificates';
import { NUCC_CROSSWALK } from './nuccCrosswalk';
import type { NuccCrosswalkEntry, SpecialtyCertificate } from './types';

const certificateById = new Map(CERTIFICATES.map((c) => [c.id, c]));
const crosswalkByCode = new Map(NUCC_CROSSWALK.map((e) => [e.code, e]));

export function getCertificate(id: string): SpecialtyCertificate | undefined {
  return certificateById.get(id);
}

/** Resolve a NUCC taxonomy code (e.g. from an NPPES record) to its crosswalk entry. */
export function resolveNuccCode(code: string): NuccCrosswalkEntry | undefined {
  return crosswalkByCode.get(code);
}

/**
 * The prerequisite chain for a certificate, root-first (e.g. interventional
 * cardiology → [internal-medicine, cardiovascular-disease]). Follows the FIRST
 * listed prerequisite at each step — a reference rendering of the canonical
 * path, not an eligibility computation.
 */
export function certificatePathTo(id: string): string[] {
  const path: string[] = [];
  let current = certificateById.get(id);
  const seen = new Set<string>([id]);
  while (current?.prerequisites?.length) {
    const parentId = current.prerequisites[0];
    if (seen.has(parentId)) break;
    seen.add(parentId);
    path.unshift(parentId);
    current = certificateById.get(parentId);
  }
  return path;
}
