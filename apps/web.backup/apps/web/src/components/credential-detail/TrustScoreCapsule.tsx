/**
 * TrustScoreCapsule Component
 * Displays trust score as a colored capsule badge
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TrustScore } from '@/lib/services/trust-service';

interface TrustScoreCapsuleProps {
  trustScore: TrustScore;
  className?: string;
}

export function TrustScoreCapsule({ trustScore, className }: TrustScoreCapsuleProps) {
  const getVariant = (): 'default' | 'secondary' | 'destructive' => {
    if (trustScore.tier === 'high') return 'default';
    if (trustScore.tier === 'medium') return 'secondary';
    return 'destructive';
  };

  const getColorClass = () => {
    if (trustScore.tier === 'high')
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (trustScore.tier === 'medium')
      return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  return (
    <Badge
      variant={getVariant()}
      className={cn('font-semibold', getColorClass(), className)}
    >
      Trust: {(trustScore.overall * 100).toFixed(0)}%
    </Badge>
  );
}

