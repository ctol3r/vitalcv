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
      className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-colors hover:border-foreground"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <span aria-hidden className="text-muted-foreground transition-transform group-hover:translate-x-0.5">→</span>
      </div>
      <p className="mt-1 text-sm text-foreground">{headline}</p>
      <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
        {valueProps.map((p) => (
          <li key={p} className="flex gap-2"><span aria-hidden>·</span><span>{p}</span></li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] uppercase tracking-wide text-muted-foreground">Reuses: {reuses.join(' · ')}</p>
    </Link>
  );
}
