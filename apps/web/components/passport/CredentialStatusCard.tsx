import { ReactNode } from 'react';
import { VerificationBadge, VerificationLevel } from './VerificationBadge';

interface CredentialStatusCardProps {
  title: string;
  level: VerificationLevel;
  value?: string;
  issuer?: string;
  updatedAt?: string;
  children?: ReactNode;
}

export function CredentialStatusCard({
  title,
  level,
  value,
  issuer,
  updatedAt,
  children,
}: CredentialStatusCardProps) {
  return (
    <div className="flex flex-col p-8 border border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-vt-neutral-900 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-xl font-medium tracking-tight text-slate-900 dark:text-slate-100">{title}</h3>
          {issuer && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{issuer}</p>}
        </div>
        <VerificationBadge level={level} />
      </div>
      
      {value && (
        <div className="mb-6">
          <p className="text-2xl font-mono text-slate-900 dark:text-slate-100">{value}</p>
        </div>
      )}
      
      {children && <div className="mt-2 mb-6 flex-1">{children}</div>}
      
      {updatedAt && (
        <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800/50">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${level === 'L3' ? 'bg-emerald-400' : level === 'L2' ? 'bg-blue-400' : 'bg-amber-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${level === 'L3' ? 'bg-emerald-500' : level === 'L2' ? 'bg-blue-500' : 'bg-amber-500'}`}></span>
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Last Verified: {updatedAt}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
