import { Shield, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';

export type VerificationLevel = 'L3' | 'L2' | 'L1' | 'L0';

interface VerificationBadgeProps {
  level: VerificationLevel;
  className?: string;
}

const LEVEL_CONFIG = {
  L3: {
    label: 'Verified',
    icon: ShieldCheck,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    border: 'border-emerald-200 dark:border-emerald-500/20',
  },
  L2: {
    label: 'Partial',
    icon: Shield,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    border: 'border-blue-200 dark:border-blue-500/20',
  },
  L1: {
    label: 'Self Asserted',
    icon: ShieldAlert,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-200 dark:border-amber-500/20',
  },
  L0: {
    label: 'Missing',
    icon: ShieldX,
    color: 'text-slate-500 dark:text-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-800',
    border: 'border-slate-200 dark:border-slate-700',
  },
};

export function VerificationBadge({ level, className = '' }: VerificationBadgeProps) {
  const config = LEVEL_CONFIG[level];
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${config.bg} ${config.border} ${className}`}>
      <Icon className={`w-4 h-4 ${config.color}`} />
      <span className={`text-xs font-semibold uppercase tracking-wider ${config.color}`}>
        {config.label} <span className="opacity-60 ml-1">[{level}]</span>
      </span>
    </div>
  );
}
