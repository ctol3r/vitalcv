'use client';

/**
 * RecentDecisionsPanel.tsx — Wave 244
 *
 * Client panel for verifier home — shows recent Decision Capsules
 * for the org's accepted applications.
 */

import { useEffect, useState } from 'react';
import { DecisionTimeline, type DecisionCapsuleEntry } from './DecisionTimeline';
import { History } from 'lucide-react';

interface RecentDecisionsPanelProps {
  heading?: string;
  limit?: number;
}

export function RecentDecisionsPanel({
  heading = 'Recent Decisions',
  limit = 5,
}: RecentDecisionsPanelProps) {
  const [capsules, setCapsules] = useState<DecisionCapsuleEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/employer/decisions')
      .then((r) => r.json())
      .then((data: { capsules?: DecisionCapsuleEntry[] }) => {
        setCapsules(data.capsules ?? []);
      })
      .catch(() => setCapsules([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div
        className="rounded-2xl border border-white/10 p-5"
        style={{ background: 'rgba(8, 14, 26, 0.6)', backdropFilter: 'blur(12px)' }}
      >
        <div className="mb-4 flex items-center gap-2">
          <History className="h-4 w-4 text-white/30" />
          <h3 className="text-sm font-semibold text-white/90">{heading}</h3>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <History className="h-4 w-4 text-white/40" />
        <h3 className="text-sm font-semibold text-white/70">{heading}</h3>
      </div>
      <DecisionTimeline
        capsules={capsules}
        limit={limit}
        heading=""
        compact
      />
    </div>
  );
}

export default RecentDecisionsPanel;
