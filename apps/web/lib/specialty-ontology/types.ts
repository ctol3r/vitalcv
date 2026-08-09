/**
 * Specialty-ontology types — the reference vocabulary for U.S. physician
 * specialties, board certificates, and training paths (K1 of the medical
 * knowledge base program; see
 * docs/research/medical-knowledge-domain-and-publications-2026-08-09.md).
 *
 * Truth posture (same contract as lib/institutions/curated.ts): this is a
 * hand-curated reference DIRECTORY. It is NOT a verification, an eligibility
 * gate, or a claim about any clinician. Prerequisite and fellowship-length
 * fields are reference transcriptions of the pinned source artifacts and may
 * under-enumerate alternate pathways — treat them as descriptive, never as a
 * gate.
 *
 * Sources of record (versioned; pin on update):
 * - ABMS Guide to Medical Specialties 2026 (PDF)
 * - ABMS Requirements for Initial Certification — Subspecialty, 2025-06 (PDF)
 * - ACGME Specialty/Subspecialty Block Diagram Table (specialtieslist.pdf, 2026)
 */

export type CertificateLevel = 'primary' | 'subspecialty';

export interface IssuingBoard {
  /** Institution id from lib/institutions/curated.ts (kind 'board'). */
  boardId: string;
  /** The board that administers a co-sponsored certificate's exam. */
  admin?: boolean;
}

export interface SpecialtyCertificate {
  /** Stable kebab-case slug (safe as a graph node id / form value). */
  id: string;
  /** Official ABMS certificate name. */
  name: string;
  level: CertificateLevel;
  /** One node per certificate; co-sponsored certificates carry multiple boards. */
  issuingBoards: readonly IssuingBoard[];
  /**
   * Alternative prerequisite certificates ("any of"). Reference-grade; omitted
   * where the requirements table could not be transcribed cleanly (see
   * prerequisiteNote instead).
   */
  prerequisites?: readonly string[];
  /** Free-text prerequisite summary where an id list would over-claim. */
  prerequisiteNote?: string;
  /** Typical accredited fellowship length in years (reference, not a gate). */
  fellowshipYears?: number | { min: number; max: number };
  /** First certificate cohorts in the 2020s. */
  emerging?: boolean;
  note?: string;
}

export type ResidencyEntryMode =
  | 'categorical'
  | 'advanced'
  | 'either'
  | 'fellowship_style'
  | 'special';

export interface ResidencyProgramType {
  /** Stable kebab-case slug, `residency-` prefixed to keep a distinct id space. */
  id: string;
  name: string;
  /** Total GME years on the standard track. */
  years: number | { min: number; max: number };
  entry: ResidencyEntryMode;
  /** Primary certificate ids this training leads to. */
  leadsTo: readonly string[];
  note?: string;
}

/**
 * NUCC provider-taxonomy crosswalk entry (physician grouping seed).
 *
 * - 'certificate': the code corresponds to a current ABMS certificate.
 * - 'practice_focus': a real NUCC concept with NO current ABMS certificate
 *   (e.g. Hospitalist, Obesity Medicine, retina practice). Not a lesser claim
 *   about the clinician — a statement about the code.
 * Codes whose mapping is uncertain, or whose certificate is AOA-issued (not yet
 * modeled), are deliberately ABSENT — recorded as a coverage gap, never guessed.
 */
export type NuccMapping =
  | { kind: 'certificate'; certificateId: string }
  | { kind: 'practice_focus' };

export interface NuccCrosswalkEntry {
  /** 10-character NUCC provider taxonomy code (v26.1). */
  code: string;
  classification: string;
  specialization: string | null;
  mapping: NuccMapping;
  /** Set when the mapping crosses a certificate rename/merge (legacy NUCC label). */
  note?: string;
}
