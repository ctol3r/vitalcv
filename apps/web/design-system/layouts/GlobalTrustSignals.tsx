'use client';

import { useProviders } from '@/hooks/useProviders';
import { useFindings } from '@/hooks/useFindings';
import { useStorylines } from '@/hooks/useStorylines';

export function GlobalTrustSignals() {
  const providers = useProviders({ limit: 1 });
  const findings = useFindings({ limit: 1 });
  const storylines = useStorylines({ limit: 1 });

  return (
    <div className="flex animate-in fade-in slide-in-from-top-2 duration-500 items-center justify-between gap-4 rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-3 shadow-sm">
      <div className="flex flex-col">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--vt-text-muted)]">Active Corpus</span>
        <div className="mt-1 flex gap-4 text-xs font-medium text-[var(--vt-text-primary)]">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
            {typeof providers.data?.total === 'number' ? providers.data.total.toLocaleString() : '---'} providers
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400"></span>
            {typeof findings.data?.total === 'number' ? findings.data.total.toLocaleString() : '---'} findings
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400"></span>
            {typeof storylines.data?.total === 'number' ? storylines.data.total.toLocaleString() : '---'} storylines
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-full bg-green-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-green-400">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500"></span>
        </span>
        System Online
      </div>
    </div>
  );
}
