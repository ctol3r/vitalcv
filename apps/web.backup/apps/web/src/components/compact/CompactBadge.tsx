'use client';

/**
 * Compact Badge Component
 *
 * Displays compact membership badges in profile (e.g., "IMLC-Member", "NLC-Member")
 */

import { Badge } from '@/components/ui/badge';
import { COMPACT_BADGE_CONFIGS } from '@/lib/compact/mobility-ui';
import type { CompactTypeEnum } from '@/lib/compact/CompactEngine';

interface CompactBadgeProps {
  compactType: CompactTypeEnum | string;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
  showIcon?: boolean;
  className?: string;
}

export function CompactBadge({
  compactType,
  variant,
  showIcon = true,
  className
}: CompactBadgeProps) {
  const config = COMPACT_BADGE_CONFIGS[compactType] || {
    compactType,
    label: `${compactType}-Member`,
    variant: 'default',
  };

  const badgeVariant = variant || config.variant === 'success' ? 'default' :
                       config.variant === 'warning' ? 'secondary' : 'outline';

  return (
    <Badge variant={badgeVariant} className={className}>
      {showIcon && config.icon && <span className="mr-1">{config.icon}</span>}
      {config.label}
    </Badge>
  );
}

interface CompactBadgeListProps {
  compactTypes: (CompactTypeEnum | string)[];
  className?: string;
}

export function CompactBadgeList({ compactTypes, className }: CompactBadgeListProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className || ''}`}>
      {compactTypes.map((type) => (
        <CompactBadge key={type} compactType={type} />
      ))}
    </div>
  );
}

