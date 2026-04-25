/**
 * Provenance vocabulary for the Clinician Profile surface.
 * Wave GOD-2
 */

export type FieldProvenance =
  | 'VERIFIED'      // Sourced from an authoritative primary source (NPPES, OIG, PECOS, State Board)
  | 'USER_ENTERED'  // Typed by the user, not PSV checked
  | 'INFERRED'      // Derived from indirect signals (e.g. publication matching)
  | 'UNKNOWN'       // No data on file
  | 'CONFLICT';     // Multiple sources disagree

export interface ProfileField<T> {
  value: T;
  provenance: FieldProvenance;
  sourceLabel?: string;
  lastUpdated?: string;
  confidence?: string;
  limitationNote?: string;
}
