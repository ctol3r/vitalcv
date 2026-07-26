'use client';

/**
 * Shared solution card (Wave 700, C2) — one component for every customer segment.
 * Tracks role selection (C5) on navigation. Accessible link card.
 */

import Link from 'next/link';
import type { SolutionRole } from '@/lib/solutions/solutions';
import { trackSolutionEvent } from '@/lib/solutions/analytics';

// Serializable props only — a Server component can't pass the Solution's
// primaryPath function across the boundary, so the path is resolved upstream.
export function SolutionCard({ role, title, headline, valueProps, reuses, href }: {
  role: SolutionRole; title: string; headline: string; valueProps: string[]; reuses: string[]; href: string;
}) {
  return (
    <Link
      href={href}
      onClick={() => trackSolutionEvent('role_selected', role)}
      className="mz-interactive group flex h-full flex-col rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-5 hover:border-[var(--vt-text-primary)]"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-[var(--vt-text-primary)]">{title}</h2>
        <span aria-hidden className="text-[var(--vt-text-muted)] transition-transform group-hover:translate-x-0.5">→</span>
      </div>
      <p className="mt-1 text-[13px] text-[var(--vt-text-secondary)]">{headline}</p>
      <ul className="mt-3 space-y-1 text-[12px] text-[var(--vt-text-secondary)]">
        {valueProps.map((p) => (
          <li key={p} className="flex gap-2"><span aria-hidden className="text-[var(--vt-text-muted)]">·</span><span>{p}</span></li>
        ))}
      </ul>
      <p className="mz-mono mt-4 text-[10px] uppercase tracking-[0.14em] text-[var(--vt-text-muted)]">Reuses: {reuses.join(' · ')}</p>
    </Link>
  );
}
