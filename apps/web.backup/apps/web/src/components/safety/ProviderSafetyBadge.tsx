'use client';

import { AlertCircle, CheckCircle2, Shield, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ProviderSafetyBadgeProps {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore?: number;
  className?: string;
}

export function ProviderSafetyBadge({ riskLevel, riskScore, className }: ProviderSafetyBadgeProps) {
  const config = {
    low: {
      label: 'Low Risk',
      icon: CheckCircle2,
      variant: 'default' as const,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    medium: {
      label: 'Medium Risk',
      icon: Shield,
      variant: 'secondary' as const,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    high: {
      label: 'High Risk',
      icon: ShieldAlert,
      variant: 'destructive' as const,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    critical: {
      label: 'Red Alert',
      icon: AlertCircle,
      variant: 'destructive' as const,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
  };

  const { label, icon: Icon, variant, color, bgColor } = config[riskLevel];

  return (
    <Badge
      variant={variant}
      className={cn('flex items-center gap-1.5 px-3 py-1.5', bgColor, className)}
    >
      <Icon className={cn('h-4 w-4', color)} />
      <span className={cn('font-medium', color)}>{label}</span>
      {riskScore !== undefined && (
        <span className={cn('text-xs ml-1', color)}>
          {(riskScore * 100).toFixed(0)}%
        </span>
      )}
    </Badge>
  );
}

