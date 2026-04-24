'use client';

import { useState, useEffect } from 'react';
import { EmployerDecisionConsole } from '@/components/review/EmployerDecisionConsole';
import type { ConsoleProps, BlockerItem, AuditEntry } from '@/components/review/EmployerDecisionConsole';
import type { LaneSnapshot } from '@/components/proof/trust-types';
import { fetchDecision } from '@/lib/decision-client';

async function buildConsoleProps(entityId: string): Promise<ConsoleProps | null> {
  try {
    const [decision, isvData] = await Promise.all([
      fetchDecision(entityId),
      fetch(`/api/isv-events?npi=${entityId}`, { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);

    const lanes: LaneSnapshot[] = decision.lanes.map(l => ({
      laneId: l.laneId,
      status: l.status,
      checkedAt: l.checkedAt,
      value: null,
      receiptId: l.hasReceipt ? l.laneId : null,
    }));

    const blockers: BlockerItem[] = decision.blockers.map(b => ({
      laneId: b.laneId,
      displayName: b.displayName,
      status: b.status,
      reason: b.reason,
      requiredAction: b.requiredAction,
      estimatedDaysImpact: b.estimatedDaysImpact,
    }));

    const auditTrail: AuditEntry[] = (isvData?.events ?? []).map((e: any) => ({
      id: e.eventId ?? Math.random().toString(),
      action: e.eventType ?? 'event',
      actor: e.payload?.employer_id ?? 'system',
      ts: e.timestamp ?? Date.now(),
    }));

    return {
      entityId: decision.entityId,
      npi: decision.npi,
      name: decision.name,
      taxonomy: '',
      state: '',
      posture: decision.posture,
      lanes,
      proofTier: decision.proofTier,
      score: decision.score,
      blockers,
      nextAction: decision.nextAction ?? 'Review source coverage below and choose an action.',
      auditTrail,
      loopId: isvData?.events?.[0]?.loopId,
    };
  } catch {
    return null;
  }
}

export default function ConsoleWrapper({ entityId }: { entityId: string }) {
  const [data, setData] = useState<ConsoleProps | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    buildConsoleProps(entityId)
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
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="font-mono text-sm text-slate-400 animate-pulse">Loading decision console…</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">
        {error ?? 'Review data unavailable.'}
      </div>
    );
  }

  return <EmployerDecisionConsole {...data} onAction={handleAction} />;
}
