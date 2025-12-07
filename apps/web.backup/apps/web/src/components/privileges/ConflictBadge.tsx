'use client';

import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { PRIVILEGE_CONFLICTS, PRIVILEGE_NODE_MAP } from '@/data/privileges';

interface ConflictBadgeProps {
  privilegeCode: string;
  conflictId?: string;
  label?: string;
}

export function ConflictBadge({ privilegeCode, conflictId, label = 'Conflict' }: ConflictBadgeProps) {
  const conflict = resolveConflict(privilegeCode, conflictId);
  if (!conflict) return null;

  const nodes = conflict.privileges
    .map((code) => PRIVILEGE_NODE_MAP.get(code))
    .filter(Boolean)
    .map((node) => `${node?.code} · ${node?.name}`);

  const badgeClass =
    conflict.severity === 'critical'
      ? 'bg-red-600 text-white border-transparent'
      : 'bg-amber-500 text-black border-transparent';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge className={`inline-flex items-center gap-1 ${badgeClass}`}>
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-left">
        <p className="font-semibold text-sm mb-1">{conflict.source}</p>
        <p className="text-xs text-primary-foreground/90">{conflict.reason}</p>
        <div className="mt-2 text-[11px] leading-tight">
          <p className="font-semibold mb-1">Impacted nodes</p>
          <ul className="list-disc list-inside space-y-0.5">
            {nodes.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function resolveConflict(privilegeCode: string, conflictId?: string) {
  if (conflictId) {
    return PRIVILEGE_CONFLICTS.find((conflict) => conflict.id === conflictId);
  }
  return PRIVILEGE_CONFLICTS.find((conflict) => conflict.privileges.includes(privilegeCode));
}


