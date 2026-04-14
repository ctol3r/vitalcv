/**
 * sealTrainingNormalizer.ts — Training Dataset Builder
 *
 * Produces the canonical SEAL training row shape from raw event tables.
 * All output is READ-ONLY from source truth — no claim fields are written.
 *
 * SAFETY CONTRACT
 * ───────────────
 * This service reads from:
 *   - advisory_outcome_events
 *   - blocker_resolution_events
 *   - employer_decision_events
 *   - start_outcome_events
 *   - vcv_entities (identity metadata only)
 *   - bundle_share_events (share context)
 *
 * It NEVER reads from and NEVER writes to:
 *   - vcv_credentials (source of truth)
 *   - claim tables (source of truth)
 *   - audit_events (append-only ledger)
 *   - readiness_score computation paths
 *
 * Output shape: SealTrainingRow
 * Used for: offline model training, feature engineering, snapshot export
 */

// ── Output shape ───────────────────────────────────────────────────────────

/**
 * Canonical SEAL training row.
 * Every field is derived from observed behavioral/outcome signals.
 * No field is a source-of-truth claim.
 */
export interface SealTrainingRow {
  // ── Row metadata ────────────────────────────────────────────
  row_id:           string;   // deterministic: entityId[:8] + '-' + decidedAt date
  entity_id_prefix: string;   // first 8 chars only — not full UUID (privacy)
  snapshot_date:    string;   // ISO date of the employer decision event

  // ── Entity features (non-PII, structural) ───────────────────
  entity_features: {
    provider_type:  string | null;   // 'INDIVIDUAL' | 'ORGANIZATION'
    npi_type:       string | null;   // 'TYPE_1' | 'TYPE_2'
  };

  // ── Trust features (from advisory snapshot — not live claims) ─
  trust_features: {
    readiness_score:     number | null;
    identity_status:     string;   // from blockersAtDecision presence
    exclusion_status:    string;
    authority_status:    string;   // 'active' | 'missing' | 'review'
    enrollment_status:   string;   // from blockers
    source_coverage:     string[]; // live sources present
    confidence_mix:      string;   // 'HIGH' | 'MIXED' | 'LOW' | 'UNKNOWN'
    blocker_count:       number;
  };

  // ── Blocker features ─────────────────────────────────────────
  blocker_features: {
    blocker_codes:      string[];
    blocker_count:      number;
    blocker_severity:   'BLOCKING' | 'WARNING' | 'NONE';
    avg_resolution_days: number | null;  // from resolved blockers for this entity
  };

  // ── Context features ─────────────────────────────────────────
  context_features: {
    has_org_context:  boolean;
    purpose_of_use:   string | null;
  };

  // ── Action features ──────────────────────────────────────────
  action_features: {
    share_sent:         boolean;   // was a share event fired before decision?
    advisory_shown:     boolean;   // was an advisory event logged?
    advisory_type:      string | null;
    employer_decision:  string;    // PROCEED | HOLD | REQUEST_REFRESH | ROUTE_TO_REVIEW | REJECT
  };

  // ── Outcome features ─────────────────────────────────────────
  outcome_features: {
    started:              boolean;
    days_to_start:        number | null;
    days_from_first_review: number | null;
    days_from_share:      number | null;
    days_from_ready:      number | null;
    blockers_at_start:    number | null;  // null if not started
  };
}

// ── Main normalizer ────────────────────────────────────────────────────────

export async function buildTrainingRows(_opts: {
  from:   Date;
  to:     Date;
  limit?: number;
}): Promise<SealTrainingRow[]> {
  // TODO: removed — referenced non-existent Prisma models:
  //   employerDecisionEvent, advisoryOutcomeEvent, startOutcomeEvent, blockerResolutionEvent
  return [];
}

// ── Dataset snapshot ───────────────────────────────────────────────────────

export interface TrainingDatasetSnapshot {
  snapshotVersion: string;   // ISO date of snapshot
  generatedAt:     string;
  rowCount:        number;
  fromDate:        string;
  toDate:          string;
  safetyAttestation: string; // invariant label
  rows:            SealTrainingRow[];
}

export async function buildTrainingSnapshot(opts: {
  from: Date;
  to:   Date;
}): Promise<TrainingDatasetSnapshot> {
  const rows = await buildTrainingRows({ from: opts.from, to: opts.to });

  return {
    snapshotVersion:    opts.to.toISOString().slice(0, 10),
    generatedAt:        new Date().toISOString(),
    rowCount:           rows.length,
    fromDate:           opts.from.toISOString().slice(0, 10),
    toDate:             opts.to.toISOString().slice(0, 10),
    // SAFETY CONTRACT: must appear in every exported dataset
    safetyAttestation:  'SEAL_TRAINING_DATA: behavioral outcomes only. Source truth (claims/artifacts/receipts/readiness core) is immutable and not included. Advisory outputs derived from this data must be labeled "Based on observed patterns".',
    rows,
  };
}

// ── Event counts (health check) ────────────────────────────────────────────

export async function getSealEventCounts(): Promise<{
  advisoryOutcomeEvents:   number;
  blockerResolutionEvents: number;
  employerDecisionEvents:  number;
  startOutcomeEvents:      number;
}> {
  // TODO: removed — referenced non-existent Prisma models:
  //   advisoryOutcomeEvent, blockerResolutionEvent, employerDecisionEvent, startOutcomeEvent
  return {
    advisoryOutcomeEvents:   0,
    blockerResolutionEvents: 0,
    employerDecisionEvents:  0,
    startOutcomeEvents:      0,
  };
}
