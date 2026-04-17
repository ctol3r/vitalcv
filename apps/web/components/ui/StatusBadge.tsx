import React from 'react';
import { CheckCircle2, Clock, AlertCircle, GitCompare } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatusBadgeState = 'Ready' | 'Pending' | 'Needs Review' | 'Contradicted';

interface StatusBadgeProps {
  status: StatusBadgeState;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  let badgeClass = '';
  let Icon = CheckCircle2;

  switch (status) {
    case 'Ready':
      badgeClass = 'badge-ready';
      Icon = CheckCircle2;
      break;
    case 'Pending':
      badgeClass = 'badge-pending';
      Icon = Clock;
      break;
    case 'Needs Review':
      badgeClass = 'badge-needs-review';
      Icon = AlertCircle;
      break;
    case 'Contradicted':
      badgeClass = 'badge-contradicted';
      Icon = GitCompare;
      break;
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border',
        'font-bold text-[10px] tracking-widest uppercase',
        badgeClass,
        className
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {status}
    </div>
  );
}
