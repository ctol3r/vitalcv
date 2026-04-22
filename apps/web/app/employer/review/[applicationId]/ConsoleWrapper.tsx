'use client';

import { useState, useEffect } from 'react';
import { EmployerDecisionConsole } from '@/components/review/EmployerDecisionConsole';
import type { ConsoleProps, BlockerItem, AuditEntry } from '@/components/review/EmployerDecisionConsole';
import type { LaneSnapshot, ReadinessPosture } from '@/components/proof/trust-types';

async function fetchSnapshotData(applicationId: string): Promise<ConsoleProps | null> {
  const B = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
  try {
    // 1. Fetch immutable application snapshot
    const bundleRes = await fetch(`${B}/api/apply/bundle/${applicationId}`, { cache: 'no-store' });
    if (!bundleRes.ok) return null;
    
    const bundle = await bundleRes.json();
    
    // 2. Build explicit lane snapshots from frozen bundle coverage
    const lanes: LaneSnapshot[] = Object.entries(bundle.trustState?.coverage ?? {}).map(([laneId, status]) => ({
      laneId,
      status: normalizeStatus(String(status)),
      checkedAt: bundle.trustState?.computed_at ? new Date(bundle.trustState.computed_at).getTime() : null,
      value: null,
      source: laneSourceName(laneId),
      receiptId: (bundle.trustState?.receipts ?? []).find((r: any) => r.lane === laneId)?.receipt_id ?? null,
    }));

    // 3. Derive blockers
    const blockers: BlockerItem[] = lanes
      .filter(l => ['adverse', 'access_required', 'unavailable', 'not_checked'].includes(l.status))
      .map(l => buildBlocker(l));

    // 4. Read exact frozen tier/posture from bundle
    const posture = bundle.trustState?.readiness_status ?? 'needs_data';
    const proofTier = bundle.tier ?? 'none';
    const score = bundle.trustState?.readiness_score ?? null;

    const nextAction = deriveNextAction(posture as ReadinessPosture, blockers);

    // 5. Audit Trail (placeholder for now, wire to real loop later)
    const auditTrail: AuditEntry[] = [];

    return {
      entityId: applicationId,
      npi: bundle.npi,
      name: bundle.clinicianName ?? `NPI ${bundle.npi}`,
      taxonomy: bundle.credentials?.[0]?.issuer ?? '',
      state: '',
      posture: posture as ReadinessPosture,
      lanes,
      proofTier: proofTier as ConsoleProps['proofTier'],
      score,
      blockers,
      nextAction,
      auditTrail,
      loopId: applicationId,
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

function deriveNextAction(posture: ReadinessPosture, blockers: BlockerItem[]): string {
  if (posture === 'blocked') return 'Manual review required — adverse finding present.';
  if (posture === 'decision_grade') return 'All required sources verified. Proceed with credentialing.';
  const topBlocker = blockers[0];
  if (topBlocker?.status === 'access_required') {
    return `Request ${topBlocker.displayName} verification or proceed with head start.`;
  }
  return 'Review source coverage below and choose an action.';
}

export default function ConsoleWrapper({ applicationId }: { applicationId: string }) {
  const [data, setData] = useState<ConsoleProps | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const B = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

  useEffect(() => {
    fetchSnapshotData(applicationId)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError('Unable to load application snapshot.'); setLoading(false); });
  }, [applicationId]);

  const handleAction = async (action: Parameters<NonNullable<ConsoleProps['onAction']>>[0]) => {
    // Actions now strictly apply to the frozen application bundle, not a live NPI
    await fetch(`${B}/api/applications/${applicationId}/workflow-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        reviewNote: `Triggered ${action} from decision console`
      }),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="font-mono text-sm text-slate-400 animate-pulse">Loading immutable snapshot…</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">
        {error ?? 'Application snapshot unavailable or expired.'}
      </div>
    );
  }

  return <EmployerDecisionConsole {...data} onAction={handleAction} />;
}
