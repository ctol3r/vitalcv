'use client';

/**
 * Claim Status Chip - Shows claim verification level with color coding
 */

import { Badge } from '@/components/ui/badge';
import { ClaimLevel } from '@/lib/npi-types';
import { cn } from '@/lib/utils';
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react';

interface ClaimStatusChipProps {
  level: ClaimLevel;
  showLabel?: boolean;
  className?: string;
}

const levelConfig = {
  0: {
    label: 'Unclaimed',
    shortLabel: 'L0',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    icon: ShieldAlert,
  },
  1: {
    label: 'Email Verified',
    shortLabel: 'L1',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: Shield,
  },
  2: {
    label: 'Identity Verified',
    shortLabel: 'L2',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    icon: Shield,
  },
  3: {
    label: 'Issuer Attested',
    shortLabel: 'L3',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    icon: ShieldCheck,
  },
};

export function ClaimStatusChip({ level, showLabel = true, className }: ClaimStatusChipProps) {
  const config = levelConfig[level];
  const Icon = config.icon;

  return (
    <Badge
      variant="secondary"
      className={cn('inline-flex items-center gap-1.5 font-medium', config.color, className)}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{showLabel ? config.label : config.shortLabel}</span>
    </Badge>
  );
}
