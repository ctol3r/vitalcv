/**
 * IssuerChip Component
 * Displays issuer name with trust badge
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { Building2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Issuer {
  id: string;
  name: string;
  trustTier?: 'verified' | 'trusted' | 'unverified';
  trustBadge?: string;
}

interface IssuerChipProps {
  issuer: Issuer;
  className?: string;
}

export function IssuerChip({ issuer, className }: IssuerChipProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex items-center gap-1.5 text-sm">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{issuer.name}</span>
      </div>
      {issuer.trustBadge && (
        <Badge
          variant={issuer.trustTier === 'verified' ? 'default' : 'secondary'}
          className="flex items-center gap-1"
        >
          <ShieldCheck className="h-3 w-3" />
          {issuer.trustBadge}
        </Badge>
      )}
    </div>
  );
}

