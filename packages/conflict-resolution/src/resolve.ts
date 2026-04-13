import { canonicalize, canonicalEqual } from "./canonicalize";
import { sourceRank } from "./priority";
import type {
  Candidate,
  FieldStatus,
  ConflictReason,
  ResolvedField,
  ResolutionResult,
  SourceRecord,
} from "./types";

/**
 * Pure, deterministic conflict-resolution engine.
 *
 * Algorithm:
 * 1. Canonicalize each record's value (trim/lowercase/sort — comparison only).
 * 2. Group records by field name.
 * 3. For each field:
 *    - All canonicalized values equal → AGREED, chosen = highest-rank source.
 *    - Multiple distinct values, single source → UNRESOLVED (INTRA_SOURCE_DUPLICATE).
 *    - Multiple distinct values, multiple sources:
 *        - Highest-rank source internally consistent → RESOLVED, chosen = that source.
 *        - Highest-rank source internally inconsistent → UNRESOLVED (INTRA_SOURCE_DUPLICATE).
 * 4. Chosen value is always the raw (non-canonicalized) value from the winning record.
 *
 * Same input → same output, always. No I/O, no clock, no randomness.
 */
export function resolveConflicts(records: SourceRecord[]): ResolutionResult {
  if (records.length === 0) {
    return { fields: {}, conflicts: [] };
  }

  const grouped = groupByField(records);
  const fields: Record<string, ResolvedField> = {};
  const conflicts: ResolvedField[] = [];

  for (const [field, fieldRecords] of Object.entries(grouped)) {
    const resolved = resolveField(field, fieldRecords);
    fields[field] = resolved;
    if (resolved.status !== "AGREED") {
      conflicts.push(resolved);
    }
  }

  return { fields, conflicts };
}

function groupByField(
  records: SourceRecord[]
): Record<string, SourceRecord[]> {
  const groups: Record<string, SourceRecord[]> = {};
  for (const record of records) {
    const key = record.field;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(record);
  }
  return groups;
}

function toCandidate(record: SourceRecord): Candidate {
  return {
    source: record.source,
    value: record.value,
    confidence: record.confidence,
    verified: record.verified,
    timestamp: record.timestamp,
  };
}

/**
 * Resolve a single field from its contributing source records.
 */
function resolveField(
  field: string,
  records: SourceRecord[]
): ResolvedField {
  const candidates = records.map(toCandidate);

  // Compute distinct canonicalized values, tracking which records map to each
  const buckets = bucketByCanonicalValue(records);
  const distinctCount = buckets.length;

  // All records agree on the same canonicalized value
  if (distinctCount === 1) {
    const highestRankRecord = pickHighestRank(records);
    return {
      field,
      status: "AGREED",
      chosen: toCandidate(highestRankRecord),
      candidates,
    };
  }

  // Multiple distinct values — check if cross-source or intra-source
  const distinctSources = new Set(records.map((r) => r.source));

  if (distinctSources.size === 1) {
    // All records from one source, but values disagree → intra-source duplicate
    return {
      field,
      status: "UNRESOLVED",
      chosen: null,
      candidates,
      reason: "INTRA_SOURCE_DUPLICATE",
    };
  }

  // Cross-source disagreement — find the highest-rank source
  const highestSource = pickHighestRankSource([...distinctSources]);
  const highestSourceRecords = records.filter(
    (r) => r.source === highestSource
  );

  // Check if the winning source is internally consistent
  const winnerBuckets = bucketByCanonicalValue(highestSourceRecords);

  if (winnerBuckets.length > 1) {
    // Winning source has internal inconsistency — refuse to pick
    return {
      field,
      status: "UNRESOLVED",
      chosen: null,
      candidates,
      reason: "INTRA_SOURCE_DUPLICATE",
    };
  }

  // Winning source is consistent — pick its value
  const chosenRecord = pickHighestRank(highestSourceRecords);
  return {
    field,
    status: "RESOLVED",
    chosen: toCandidate(chosenRecord),
    candidates,
    reason: "CROSS_SOURCE",
  };
}

type ValueBucket = {
  canonical: unknown;
  records: SourceRecord[];
};

/**
 * Groups records by their canonicalized value.
 * Returns one bucket per distinct canonicalized value.
 */
function bucketByCanonicalValue(records: SourceRecord[]): ValueBucket[] {
  const buckets: ValueBucket[] = [];

  for (const record of records) {
    const canonical = canonicalize(record.value);
    const existing = buckets.find((b) => canonicalEqual(b.canonical, canonical));
    if (existing) {
      existing.records.push(record);
    } else {
      buckets.push({ canonical, records: [record] });
    }
  }

  return buckets;
}

/**
 * From a set of records, pick the one with the highest source rank.
 * If multiple records share the highest rank, pick the first one encountered
 * (stable — input order is preserved).
 */
function pickHighestRank(records: SourceRecord[]): SourceRecord {
  let best = records[0];
  for (let i = 1; i < records.length; i++) {
    if (sourceRank(records[i].source) > sourceRank(best.source)) {
      best = records[i];
    }
  }
  return best;
}

/**
 * From a set of source names, return the one with the highest rank.
 */
function pickHighestRankSource(
  sources: SourceRecord["source"][]
): SourceRecord["source"] {
  let best = sources[0];
  for (let i = 1; i < sources.length; i++) {
    if (sourceRank(sources[i]) > sourceRank(best)) {
      best = sources[i];
    }
  }
  return best;
}
