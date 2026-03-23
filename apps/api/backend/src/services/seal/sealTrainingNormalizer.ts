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

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

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

// ── Helpers ────────────────────────────────────────────────────────────────

function inferExclusionStatus(blockers: string[]): string {
  if (blockers.some(b => /excluded|exclusion/i.test(b)))  return 'EXCLUDED';
  if (blockers.some(b => /possible_match|possible match/i.test(b))) return 'POSSIBLE_MATCH';
  return 'CLEAR';
}

function inferAuthorityStatus(blockers: string[]): string {
  if (blockers.some(b => /licen|disciplin|expired/i.test(b))) return 'review';
  if (blockers.some(b => /missing.*licen/i.test(b))) return 'missing';
  return 'active';
}

function inferEnrollmentStatus(blockers: string[]): string {
  if (blockers.some(b => /enrollment not found|pecos/i.test(b))) return 'NOT_FOUND';
  if (blockers.some(b => /enrollment.*review/i.test(b))) return 'UNKNOWN';
  return 'ENROLLED_OR_UNCHECKED';
}

function inferConfidenceMix(sourceCoverage: Record<string, unknown>): string {
  const live = (sourceCoverage['live'] as string[] | undefined) ?? [];
  const gated = (sourceCoverage['gated'] as string[] | undefined) ?? [];
  const mock = (sourceCoverage['mock'] as string[] | undefined) ?? [];
  if (live.length >= 2 && gated.length > 0) return 'HIGH';
  if (live.length >= 2) return 'MIXED';
  if (live.length > 0 || mock.length > 0) return 'LOW';
  return 'UNKNOWN';
}

function blockerSeverity(count: number): 'BLOCKING' | 'WARNING' | 'NONE' {
  if (count >= 2) return 'BLOCKING';
  if (count === 1) return 'WARNING';
  return 'NONE';
}

// ── Main normalizer ────────────────────────────────────────────────────────

export async function buildTrainingRows(opts: {
  from:   Date;
  to:     Date;
  limit?: number;
}): Promise<SealTrainingRow[]> {
  const { from, to, limit = 10_000 } = opts;

  // Anchor on employer_decision_events — the most informative label signal
  // Fetch decisions with related entity + orgContext via include (Prisma join)
  const decisions = await prisma.employerDecisionEvent.findMany({
    where:   { decidedAt: { gte: from, lte: to } },
    orderBy: { decidedAt: 'asc' },
    take:    limit,
    include: {
      entity:              { select: { npiType: true, entityType: true } },
      organizationContext: { select: { contextType: true } },
    },
  });

  if (decisions.length === 0) return [];

  // Batch-fetch related events per entity
  const entityIds = [...new Set(decisions.map(d => d.entityId))];

  const [advisoryMap, shareMap, startMap, avgResolutionMap] = await Promise.all([
    // Last advisory event before each decision
    prisma.advisoryOutcomeEvent.findMany({
      where:   { entityId: { in: entityIds }, eventTimestamp: { lte: to } },
      orderBy: { eventTimestamp: 'desc' },
      select: {
        entityId:              true,
        eventType:             true,
        blockersAtEvent:       true,
        readinessScoreAtEvent: true,
        sourceCoverageAtEvent: true,
        eventTimestamp:        true,
      },
    }).then(rows => {
      // Key: entityId → most recent event before decision
      const map = new Map<string, typeof rows[0]>();
      for (const row of rows) {
        if (!map.has(row.entityId)) map.set(row.entityId, row);
      }
      return map;
    }),

    // Did a share event fire before the decision?
    prisma.advisoryOutcomeEvent.findMany({
      where: { entityId: { in: entityIds }, eventType: 'SHARE_INITIATED', eventTimestamp: { lte: to } },
      select: { entityId: true },
    }).then(rows => new Set(rows.map(r => r.entityId))),

    // Start outcome events
    prisma.startOutcomeEvent.findMany({
      where:   { entityId: { in: entityIds } },
      orderBy: { startedAt: 'asc' },
      select: {
        entityId:              true,
        startedAt:             true,
        daysFromFirstReview:   true,
        daysFromShare:         true,
        daysFromReady:         true,
        readinessScoreAtStart: true,
        blockersAtStart:       true,
      },
    }).then(rows => {
      const map = new Map<string, typeof rows[0]>();
      for (const row of rows) {
        if (!map.has(row.entityId)) map.set(row.entityId, row);
      }
      return map;
    }),

    // Average resolution days per entity from resolved blockers
    prisma.blockerResolutionEvent.groupBy({
      by:     ['entityId'],
      where:  { entityId: { in: entityIds }, status: 'RESOLVED', resolutionDays: { not: null } },
      _avg:   { resolutionDays: true },
    }).then(rows => {
      const map = new Map<string, number | null>();
      for (const row of rows) map.set(row.entityId, row._avg.resolutionDays);
      return map;
    }),
  ]);

  const rows: SealTrainingRow[] = [];

  for (const d of decisions) {
    try {
      const blockers = Array.isArray(d.blockersAtDecision)
        ? (d.blockersAtDecision as string[])
        : [];
      const trustSnapshot = (d.trustSnapshotAtDecision ?? {}) as Record<string, unknown>;
      const advisory      = advisoryMap.get(d.entityId);
      const sourceCov     = (advisory?.sourceCoverageAtEvent ?? trustSnapshot['sourceCoverage'] ?? {}) as Record<string, unknown>;
      const startEvent    = startMap.get(d.entityId);
      const orgCtx = d.organizationContext;

      const row: SealTrainingRow = {
        row_id:           `${d.entityId.slice(0, 8)}-${d.decidedAt.toISOString().slice(0, 10)}`,
        entity_id_prefix: d.entityId.slice(0, 8),
        snapshot_date:    d.decidedAt.toISOString().slice(0, 10),

        entity_features: {
          provider_type: (d as typeof d & { entity?: { entityType?: string } }).entity?.entityType ?? null,
          npi_type:      (d as typeof d & { entity?: { npiType?: string } }).entity?.npiType ?? null,
        },

        trust_features: {
          readiness_score:   d.readinessScoreAtDecision ?? null,
          identity_status:   blockers.some(b => /identity/i.test(b)) ? 'missing' : 'confirmed',
          exclusion_status:  inferExclusionStatus(blockers),
          authority_status:  inferAuthorityStatus(blockers),
          enrollment_status: inferEnrollmentStatus(blockers),
          source_coverage:   (sourceCov['live'] as string[] | undefined) ?? [],
          confidence_mix:    inferConfidenceMix(sourceCov),
          blocker_count:     blockers.length,
        },

        blocker_features: {
          blocker_codes:       blockers,
          blocker_count:       blockers.length,
          blocker_severity:    blockerSeverity(blockers.length),
          avg_resolution_days: avgResolutionMap.get(d.entityId) ?? null,
        },

        context_features: {
          has_org_context: !!d.organizationContextId,
          // contextType mapped from VcvOrgContextType enum (CREDENTIALING, APPLICATION, etc.)
          purpose_of_use: (orgCtx as { contextType?: string } | null)?.contextType ?? null,
        },

        action_features: {
          share_sent:        shareMap.has(d.entityId),
          advisory_shown:    !!advisory,
          advisory_type:     advisory?.eventType ?? null,
          employer_decision: d.decision,
        },

        outcome_features: {
          started:                !!startEvent,
          days_to_start:          startEvent?.daysFromFirstReview ?? null,
          days_from_first_review: startEvent?.daysFromFirstReview ?? null,
          days_from_share:        startEvent?.daysFromShare ?? null,
          days_from_ready:        startEvent?.daysFromReady ?? null,
          blockers_at_start:      startEvent
            ? (Array.isArray(startEvent.blockersAtStart)
                ? (startEvent.blockersAtStart as string[]).length
                : 0)
            : null,
        },
      };

      rows.push(row);
    } catch (rowErr) {
      log('warn', 'seal_training_row_build_failed', {
        decisionId: d.id,
        error: rowErr instanceof Error ? rowErr.message : String(rowErr),
      });
    }
  }

  return rows;
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
  const [advisory, blocker, decision, start] = await Promise.all([
    prisma.advisoryOutcomeEvent.count(),
    prisma.blockerResolutionEvent.count(),
    prisma.employerDecisionEvent.count(),
    prisma.startOutcomeEvent.count(),
  ]);
  return {
    advisoryOutcomeEvents:   advisory,
    blockerResolutionEvents: blocker,
    employerDecisionEvents:  decision,
    startOutcomeEvents:      start,
  };
}
