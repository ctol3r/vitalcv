/**
 * entityDecision.ts — Canonical Decision Contract
 *
 * GET /api/decision/:entityId
 *
 * Projects TrustPassport into a stable DecisionOutput shape.
 * Consumers (web ConsoleWrapper, mobile ReadinessService) call this
 * endpoint instead of deriving posture, score, and blockers locally.
 *
 * Accepts either an entity UUID or a 10-digit NPI — disambiguated by regex.
 */

import type { Express, Request, Response } from 'express';
import { buildPassport, buildPassportByNpi } from '../services/entity/passportService';
import { log } from '../obs/logger';
import type { CanonicalSourceCoverageState } from '@vitalcv/trust-state';

// ─── Exported canonical types ──────────────────────────────────────────────────

export type DecisionLaneStatus =
  | 'verified'
  | 'in_progress'
  | 'not_checked'
  | 'stale'
  | 'unavailable'
  | 'access_required'
  | 'review_required'
  | 'adverse';

export type DecisionPostureValue =
  | 'unchecked'
  | 'checking'
  | 'partial'
  | 'decision_grade'
  | 'blocked'
  | 'degraded';

export interface DecisionLane {
  laneId: string;
  displayName: string;
  status: DecisionLaneStatus;
  checkedAt: number | null;
  hasReceipt: boolean;
}

export interface DecisionBlocker {
  laneId: string;
  displayName: string;
  status: DecisionLaneStatus;
  reason: string;
  requiredAction: string;
  estimatedDaysImpact: number | null;
}

export interface DecisionOutput {
  entityId: string;
  npi: string;
  name: string;
  posture: DecisionPostureValue;
  postureLabel: string;
  score: number | null;
  lanes: DecisionLane[];
  blockers: DecisionBlocker[];
  nextAction: string | null;
  pendingCount: number;
  adverseCount: number;
  proofTier: 'none' | 'partial' | 'decision_grade';
  checkedAt: string | null;
}

// ─── Mappings ──────────────────────────────────────────────────────────────────

const SOURCE_LANE_IDS: Record<string, string> = {
  NPPES_API:    'nppes_identity',
  OIG_LEIE:     'oig_exclusions',
  PECOS_PUBLIC: 'pecos_enrollment',
  STATE_BOARD:  'state_license',
};

const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  NPPES_API:    'NPPES Identity',
  OIG_LEIE:     'OIG Exclusions',
  PECOS_PUBLIC: 'PECOS Enrollment',
  STATE_BOARD:  'State License',
};

const POSTURE_LABELS: Record<DecisionPostureValue, string> = {
  unchecked:      'Not yet checked',
  checking:       'Verification in progress',
  partial:        'Partial coverage',
  decision_grade: 'Decision-ready',
  blocked:        'Adverse finding present',
  degraded:       'Refresh required',
};

const BLOCKER_REQUIRED_ACTIONS: Record<string, string> = {
  nppes_identity:   'Check NPI validity or retry — source may be temporarily unreachable.',
  oig_exclusions:   'Configure OIG API access or request manual check.',
  pecos_enrollment: 'Verify PECOS enrollment status via CMS portal.',
  state_license:    'Request license upload from clinician or verify via board portal.',
};

const BLOCKER_ESTIMATED_DAYS: Record<string, number> = {
  nppes_identity:   1,
  oig_exclusions:   2,
  pecos_enrollment: 5,
  state_license:    14,
};

function coverageStateToLaneStatus(state: CanonicalSourceCoverageState): DecisionLaneStatus {
  switch (state) {
    case 'checked':          return 'verified';
    case 'stale':            return 'stale';
    case 'pending':          return 'in_progress';
    case 'gated':            return 'access_required';
    case 'unavailable':      return 'unavailable';
    case 'accessRequired':   return 'access_required';
    case 'reviewRequired':   return 'review_required';
    case 'notDecisionGrade': return 'not_checked';
    case 'previewOnly':      return 'not_checked';
    default:                 return 'not_checked';
  }
}

function readinessStateToPosture(state: string): DecisionPostureValue {
  switch (state) {
    case 'DECISION_GRADE': return 'decision_grade';
    case 'BLOCKED':        return 'blocked';
    case 'PARTIAL':        return 'partial';
    case 'CHECKING':       return 'checking';
    default:               return 'unchecked';
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

const NPI_RE = /^\d{10}$/;

export function registerEntityDecisionRoute(app: Express): void {
  app.get(
    '/api/decision/:entityId',
    async (req: Request, res: Response) => {
      const { entityId } = req.params;
      if (!entityId?.trim()) {
        res.status(400).json({ error: 'entityId is required.' });
        return;
      }

      try {
        const isNpi = NPI_RE.test(entityId);
        const passport = isNpi
          ? await buildPassportByNpi(entityId)
          : await buildPassport(entityId);

        if (!passport) {
          res.status(404).json({ error: 'Entity not found.' });
          return;
        }

        const npi = passport.npi ?? passport.identity.npi ?? '';
        const resolvedEntityId = passport.entityId ?? entityId;
        const name = passport.identity.displayName;
        const posture = readinessStateToPosture(passport.readiness.status);
        const rawScore = passport.readiness.score ?? 0;
        const score = rawScore > 0 ? rawScore : null;
        const checkedAt = passport.lastCheckedAt ?? null;

        // Build lanes from canonical source coverage
        const lanes: DecisionLane[] = passport.sourceCoverage.checks.map((check) => {
          const laneId = SOURCE_LANE_IDS[check.sourceId] ?? check.sourceId.toLowerCase().replace(/_/g, '-');
          const displayName = SOURCE_DISPLAY_NAMES[check.sourceId] ?? check.sourceId;
          const status = coverageStateToLaneStatus(check.state);
          const checkedAtMs = check.checkedAt ? new Date(check.checkedAt).getTime() : null;
          const hasReceipt = (check.proof?.receiptIds?.length ?? 0) > 0;
          return { laneId, displayName, status, checkedAt: checkedAtMs, hasReceipt };
        });

        // Build blockers from decisionPosture.missing (sources not yet proven)
        const blockers: DecisionBlocker[] = passport.decisionPosture.missing.map((source) => {
          const laneId = SOURCE_LANE_IDS[source.sourceId] ?? source.sourceId.toLowerCase();
          const displayName = SOURCE_DISPLAY_NAMES[source.sourceId] ?? source.sourceId;
          const lane = lanes.find((l) => l.laneId === laneId);
          const status = lane?.status ?? coverageStateToLaneStatus(source.state);
          return {
            laneId,
            displayName,
            status,
            reason: source.reason,
            requiredAction: BLOCKER_REQUIRED_ACTIONS[laneId] ?? 'Review lane and take appropriate action.',
            estimatedDaysImpact: BLOCKER_ESTIMATED_DAYS[laneId] ?? null,
          };
        });

        const PENDING_STATUSES = new Set<DecisionLaneStatus>(['not_checked', 'in_progress', 'unavailable', 'access_required']);
        const pendingCount = lanes.filter((l) => PENDING_STATUSES.has(l.status)).length;
        const adverseCount = posture === 'blocked' ? Math.max(1, blockers.length) : 0;

        const proofTier: DecisionOutput['proofTier'] =
          posture === 'decision_grade' ? 'decision_grade'
          : lanes.some((l) => l.status === 'verified') ? 'partial'
          : 'none';

        const output: DecisionOutput = {
          entityId: resolvedEntityId,
          npi,
          name,
          posture,
          postureLabel: POSTURE_LABELS[posture],
          score,
          lanes,
          blockers,
          nextAction: passport.decisionPosture.nextAction ?? null,
          pendingCount,
          adverseCount,
          proofTier,
          checkedAt,
        };

        res.json(output);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        log('error', 'entity_decision_route: failed', { entityId, error: message });
        res.status(500).json({ error: 'Failed to compute decision output.' });
      }
    },
  );

  log('info', 'entity_decision_route_registered', { route: 'GET /api/decision/:entityId' });
}
