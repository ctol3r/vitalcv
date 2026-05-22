'use client';
/**
 * ConsoleWrapper — wave-134
 *
 * Wraps EmployerDecisionConsole with real data fetching.
 * Falls back to ReviewPageClient for full backward compatibility.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { EmployerDecisionConsole } from '@/components/review/EmployerDecisionConsole';
import type {
  ConsoleProps, BlockerItem, AuditEntry,
} from '@/components/review/EmployerDecisionConsole';
import type { LaneSnapshot, ReadinessPosture } from '@/components/proof/trust-types';
import { normalizeTrustContainerManifestView } from '@/lib/trust/trust-container-view';

// ─── Data adapter ─────────────────────────────────────────────────

async function fetchConsoleData(entityId: string): Promise<ConsoleProps | null> {
  try {
    // 1. Fetch proof manifest
    const manifestRes = await fetch('/api/manifest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npi: entityId }),
      cache: 'no-store',
    });

    const manifestData = manifestRes.ok ? await manifestRes.json() : null;
    const manifest = manifestData?.manifest ?? null;

    // 2. Build lane snapshots from manifest
    const lanes: LaneSnapshot[] = Object.entries(manifest?.coverage ?? {}).map(([laneId, status]) => ({
      laneId,
      status: normalizeStatus(String(status)),
      checkedAt: manifest?.generatedAt ? new Date(manifest.generatedAt).getTime() : null,
      value: null,
      source: laneSourceName(laneId),
      receiptId: (manifest?.receipts ?? []).find((r: any) => r.lane === laneId)?.receipt_id ?? null,
    }));

    // 3. Derive blockers
    const blockers: BlockerItem[] = lanes
      .filter(l => ['adverse', 'access_required', 'unavailable', 'not_checked'].includes(l.status))
      .map(l => buildBlocker(l));

    // 4. Derive decision metadata (Wave 39: deterministic from lane
    //    evidence ONLY; manifest.tier never overrides degraded /
    //    incomplete lane states). The required-lane gate ensures
    //    decision_grade is only emitted when every required lane is
    //    affirmatively `verified` (source-confirmed).
    const posture = derivePosture(lanes);

    const score = (() => {
      const verified = lanes.filter(l => l.status === 'verified').length;
      return verified > 0 ? Math.round((verified / Math.max(lanes.length, 1)) * 100) : null;
    })();

    const nextAction = deriveNextAction(posture, blockers);

    // 5. Fetch ISV audit trail
    const isvRes = await fetch(`/api/isv-events?npi=${entityId}`, { cache: 'no-store' }).catch(() => null);
    const isvData = isvRes?.ok ? await isvRes.json() : null;
    const auditTrail: AuditEntry[] = (isvData?.events ?? []).map((e: any) => ({
      id: e.eventId ?? Math.random().toString(),
      action: e.eventType ?? 'event',
      actor: e.payload?.employer_id ?? 'system',
      ts: e.timestamp ?? Date.now(),
    }));

    return {
      entityId,
      npi: entityId,
      name: manifest?.subject?.display_name ?? `NPI ${entityId}`,
      taxonomy: '',
      state: '',
      posture,
      lanes,
      proofTier: (manifest?.tier ?? 'none') as ConsoleProps['proofTier'],
      score,
      blockers,
      nextAction,
      auditTrail,
      loopId: isvData?.events?.[0]?.loopId,
      trustContainer: normalizeTrustContainerManifestView(manifest?.trustContainer),
    };
  } catch {
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

function normalizeStatus(raw: string): LaneSnapshot['status'] {
  const map: Record<string, LaneSnapshot['status']> = {
    verified: 'verified', checked: 'verified',
    access_required: 'access_required',
    unavailable: 'unavailable',
    stale: 'stale',
    adverse: 'adverse', blocked_signal: 'adverse',
    in_progress: 'in_progress', pending: 'in_progress',
  };
  return (map[raw] ?? 'not_checked') as LaneSnapshot['status'];
}

function laneSourceName(laneId: string): string {
  const sources: Record<string, string> = {
    nppes_identity: 'CMS NPPES', oig_exclusions: 'OIG LEIE',
    state_license: 'State Board', employment_history: 'The Work Number',
  };
  return sources[laneId] ?? laneId;
}

function buildBlocker(lane: LaneSnapshot): BlockerItem {
  const config: Record<string, Omit<BlockerItem, 'laneId' | 'status'>> = {
    oig_exclusions: {
      displayName: 'OIG Exclusions',
      reason: 'OIG LEIE check not yet integrated — source requires institutional access.',
      requiredAction: 'Configure OIG API access or request manual check.',
      estimatedDaysImpact: 2,
    },
    state_license: {
      displayName: 'State License',
      reason: 'State board verification not yet integrated for this jurisdiction.',
      requiredAction: 'Request license upload from clinician or verify via board portal.',
      estimatedDaysImpact: 14,
    },
    nppes_identity: {
      displayName: 'NPPES Identity',
      reason: `NPPES source is ${lane.status}.`,
      requiredAction: lane.status === 'unavailable' ? 'Retry — source temporarily unreachable.' : 'Check NPI validity.',
      estimatedDaysImpact: 1,
    },
  };

  const defaults = config[lane.laneId] ?? {
    displayName: lane.laneId.replace(/_/g, ' '),
    reason: `Lane status: ${lane.status}`,
    requiredAction: 'Review lane and take appropriate action.',
    estimatedDaysImpact: null,
  };

  return { laneId: lane.laneId, status: lane.status, ...defaults };
}

/**
 * Wave 39: deterministic-confidence enforcement.
 *
 * The required-lane set is the closed list of lanes that MUST be
 * affirmatively `verified` before any positive posture is allowed.
 * If any required lane is missing or sits in a degraded state
 * (`access_required`, `unavailable`, `stale`, `not_checked`,
 * `in_progress`), the posture cannot reach `decision_grade`. The
 * manifest.tier value is intentionally NOT consulted here; the
 * substrate cannot grant clearance.
 */
const REQUIRED_LANES_FOR_DECISION_GRADE: readonly string[] = [
  'nppes_identity',
  'oig_exclusions',
  'state_license',
  'employment_history',
];

function derivePosture(lanes: LaneSnapshot[]): ReadinessPosture {
  // 1. Any adverse finding always blocks.
  if (lanes.some((l) => l.status === 'adverse')) {
    return 'blocked';
  }
  // 2. Required-lane completeness gate. Every required lane MUST be
  //    affirmatively `verified` to reach `decision_grade`. Any
  //    degraded state on a required lane drops the posture.
  const requiredVerified = REQUIRED_LANES_FOR_DECISION_GRADE.every((requiredLane) => {
    const lane = lanes.find((l) => l.laneId === requiredLane);
    return lane?.status === 'verified';
  });
  if (requiredVerified) {
    return 'decision_grade';
  }
  // 3. At least one lane is verified but the required set is
  //    incomplete: partial. Otherwise: needs_data.
  if (lanes.some((l) => l.status === 'verified')) {
    return 'partial';
  }
  return 'needs_data';
}

function deriveNextAction(posture: ReadinessPosture, blockers: BlockerItem[]): string {
  if (posture === 'blocked') {
    return 'Adverse finding detected. Institution review required before any decision; do not proceed without institutional sign-off.';
  }
  if (posture === 'decision_grade') {
    return 'Lane evidence completed. Institution review still required before a final decision; this surface does not grant clearance.';
  }
  // Any non-decision_grade posture explicitly names the missing
  // evidence so the operator sees the deterministic gap.
  const topBlocker = blockers[0];
  if (topBlocker?.status === 'access_required') {
    return `Additional evidence required: ${topBlocker.displayName} requires institutional access. Institution review still required.`;
  }
  if (topBlocker?.status === 'unavailable') {
    return `Source unavailable: ${topBlocker.displayName} did not respond within the freshness budget. Institution review still required.`;
  }
  if (topBlocker?.status === 'stale') {
    return `Stale evidence: ${topBlocker.displayName} is past the freshness budget. Re-fetch on the institution's own credential.`;
  }
  if (topBlocker?.status === 'not_checked') {
    return `Review incomplete: ${topBlocker.displayName} has not been checked. Institution review still required.`;
  }
  return 'Review incomplete: source data is being checked. Institution review still required; this surface does not grant clearance.';
}

// ─── Component ────────────────────────────────────────────────────

export default function ConsoleWrapper({ entityId }: { entityId: string }) {
  const [data, setData] = useState<ConsoleProps | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchConsoleData(entityId)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError('Unable to load review data.'); setLoading(false); });
  }, [entityId]);

  const handleAction = async (action: Parameters<NonNullable<ConsoleProps['onAction']>>[0]) => {
    await fetch('/api/employer-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        npi: entityId,
        employerId: 'pilot-employer-1',
        action,
        loopId: data?.loopId,
      }),
    });
    // Record ISV event
    await fetch('/api/isv-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        npi: entityId,
        eventType: 'action.taken',
        payload: { action },
        loopId: data?.loopId,
      }),
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] gap-3">
        <div className="h-px w-24 bg-border overflow-hidden rounded-full">
          <div className="h-full w-1/2 bg-muted-foreground/40 animate-[slide_1.5s_ease-in-out_infinite]" />
        </div>
        <p className="text-sm text-muted-foreground">Reviewing source data…</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="bg-muted border border-border rounded-xl px-5 py-4 text-sm text-muted-foreground">
        {error ?? 'Source data unavailable at this time.'}
      </div>
    );
  }

  return <EmployerDecisionConsole {...data} onAction={handleAction} />;
}
