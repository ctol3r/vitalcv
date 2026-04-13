/**
 * Closed union of data sources. Adding a new source is a deliberate
 * type-level change that forces the priority table to stay exhaustive.
 */
export type Source = "STATE" | "NPPES" | "USER" | "RESUME";

/**
 * A single field-level observation from a source.
 * The engine operates on a flat bag of these — one per (source, field) claim.
 */
export type SourceRecord = {
  source: Source;
  field: string;
  value: unknown;
  /** 0..1 — recorded for audit, NOT used for resolution in v1 */
  confidence: number;
  /** recorded for audit, NOT used for resolution in v1 */
  verified: boolean;
  /** epoch ms — recorded for audit, NOT used for resolution in v1 */
  timestamp: number;
};

export type FieldStatus = "AGREED" | "RESOLVED" | "UNRESOLVED";

export type Candidate = {
  source: Source;
  /** Original non-canonicalized value from the source record */
  value: unknown;
  confidence: number;
  verified: boolean;
  timestamp: number;
};

export type ConflictReason = "CROSS_SOURCE" | "INTRA_SOURCE_DUPLICATE";

export type ResolvedField = {
  field: string;
  status: FieldStatus;
  /** null only when status is UNRESOLVED */
  chosen: Candidate | null;
  /** All contributing records — includes the chosen one when present */
  candidates: Candidate[];
  /** Set when status is not AGREED */
  reason?: ConflictReason;
};

export type ResolutionResult = {
  /** One entry per field name that appeared in the input */
  fields: Record<string, ResolvedField>;
  /** Projection: all fields where status !== AGREED */
  conflicts: ResolvedField[];
};
