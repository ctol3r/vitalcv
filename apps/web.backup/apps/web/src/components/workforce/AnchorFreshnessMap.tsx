/**
 * Anchor Freshness Map Component
 * Phase 3: Task 21 - Anchor freshness map for unit staff
 */

'use client';

import { Badge } from '@/components/ui/badge';
import type { AnchorFreshnessMap } from '@/lib/workforce/models';
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

interface AnchorFreshnessMapProps {
  anchorFreshness: AnchorFreshnessMap;
}

export function AnchorFreshnessMap({ anchorFreshness }: AnchorFreshnessMapProps) {
  const entries = Object.entries(anchorFreshness);

  if (entries.length === 0) {
    return <p className="text-muted-foreground">No anchor data available</p>;
  }

  const getFreshnessBadge = (freshness: 'fresh' | 'stale' | 'critical') => {
    switch (freshness) {
      case 'fresh':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Fresh
          </Badge>
        );
      case 'stale':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">
            <Clock className="h-3 w-3 mr-1" />
            Stale
          </Badge>
        );
      case 'critical':
        return (
          <Badge variant="destructive">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Critical
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-2">
      {entries.map(([clinicianId, data]) => (
        <div
          key={clinicianId}
          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">{clinicianId}</span>
              {getFreshnessBadge(data.freshness)}
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Last anchored: {new Date(data.lastAnchored).toLocaleDateString()}</span>
              <span>{data.daysSinceAnchor} days since anchor</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}








