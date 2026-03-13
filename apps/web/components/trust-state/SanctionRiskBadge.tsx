'use client';

import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function SanctionRiskBadge({
  hasRisk = false,
  label,
}: {
  hasRisk?: boolean;
  label?: string;
}) {
  return (
    <Badge
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium border ${
        hasRisk
          ? 'bg-red-50/80 text-red-700 border-red-200 hover:bg-red-50'
          : 'bg-emerald-50/80 text-emerald-700 border-emerald-200 hover:bg-emerald-50'
      }`}
    >
      {hasRisk ? (
        <AlertTriangle className="h-3 w-3" />
      ) : (
        <ShieldCheck className="h-3 w-3" />
      )}
      {label || (hasRisk ? 'Sanction Risk Detected' : 'No Sanction Risk')}
    </Badge>
  );
}
