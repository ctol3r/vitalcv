import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, RefreshCw, SearchCheck, Send, Wallet } from 'lucide-react';

/**
 * HeroLoopPills — the deck's four-stage career loop as a compact, connected
 * pill strip in the hero (Chris, 2026-07-18): Free CV Wallet → MATCHA → Apply
 * → Reuse. It is a NAVIGATION + orientation visual, not a claim: each pill is a
 * real destination, and the copy names a product stage, never an outcome
 * ("Reuse" is the honest flywheel close, not "hired"/"verified").
 *
 * The connecting arrows carry the alternating primary palette (indigo → green)
 * so the loop reads as one motion left to right.
 */

const STAGES: ReadonlyArray<{
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number }>;
}> = [
  { label: 'Free CV Wallet', href: '/onboarding', icon: Wallet },
  { label: 'MATCHA', href: '#matcha', icon: SearchCheck },
  { label: 'Apply', href: '#apply', icon: Send },
  { label: 'Reuse', href: '#employers', icon: RefreshCw },
];

export function HeroLoopPills() {
  return (
    <nav
      data-home-loop-pills=""
      aria-label="The VitalCV career loop"
      className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-2"
    >
      {STAGES.map((stage, i) => {
        const Icon = stage.icon;
        return (
          <React.Fragment key={stage.label}>
            {i > 0 ? (
              <ArrowRight
                size={14}
                aria-hidden="true"
                className="shrink-0"
                style={{ color: i % 2 === 1 ? 'var(--accent)' : 'var(--vt-accent-emerald)' }}
              />
            ) : null}
            <Link
              href={stage.href}
              data-loop-pill={stage.label}
              className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface)] py-1.5 pl-1.5 pr-3 transition-colors hover:border-[var(--vt-text-primary)]"
            >
              <span
                aria-hidden="true"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                style={{
                  background:
                    i % 2 === 0
                      ? 'color-mix(in oklab, var(--accent) 14%, transparent)'
                      : 'color-mix(in oklab, var(--vt-accent-emerald) 16%, transparent)',
                  color: i % 2 === 0 ? 'var(--accent)' : 'var(--vt-accent-emerald)',
                }}
              >
                <Icon size={12} />
              </span>
              <span className="whitespace-nowrap text-[12.5px] font-semibold text-[var(--vt-text-primary)]">{stage.label}</span>
            </Link>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export default HeroLoopPills;
