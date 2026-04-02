'use client';

/**
 * SystemCapacityBadge.tsx — Wave 240
 *
 * Shows system-wide "Starts Enabled" as a live badge on the homepage.
 * Only renders if startsEnabled > 0.
 */

import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';

interface SystemCapacity {
  totalStartsEnabled: number;
  totalOpenPositions: number;
}

export default function SystemCapacityBadge() {
  const [data, setData] = useState<SystemCapacity | null>(null);

  useEffect(() => {
    fetch('/api/capacity/system')
      .then((r) => r.json() as Promise<SystemCapacity>)
      .then(setData)
      .catch(() => {/* silent fail — homepage must always render */});
  }, []);

  if (!data || data.totalStartsEnabled <= 0) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <div
        className="flex items-center gap-2.5 rounded-full px-4 py-2 border border-emerald-500/20"
        style={{ background: 'rgba(16,185,129,0.06)' }}
      >
        <Zap className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-sm font-semibold text-emerald-400">
          {data.totalStartsEnabled} physician start{data.totalStartsEnabled !== 1 ? 's' : ''} enabled this quarter
        </span>
        {data.totalOpenPositions > 0 && (
          <span className="text-xs text-muted-foreground/60">
            · {data.totalOpenPositions} open positions
          </span>
        )}
      </div>
    </div>
  );
}
