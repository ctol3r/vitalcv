'use client';

/**
 * PrequalifyBar — Wave 182
 * Persistent bottom completion bar — shown when a user hasn't finished prequalification.
 * Inspired by Mercor's "resume / assessment" persistent prompt.
 * Feature-flagged behind FEATURE_PREQUALIFY_FLOW_V2.
 */

import { FEATURES } from '@/lib/features';
import { X, Zap } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';

const PrequalifyModal = dynamic(() => import('./PrequalifyModal'), { ssr: false });

interface Step { label: string; done: boolean }

const DEFAULT_STEPS: Step[] = [
  { label: 'NPI Verified',       done: false },
  { label: 'Links Added',        done: false },
  { label: 'Work Auth',          done: false },
];

interface PrequalifyBarProps {
  steps?: Step[];
  /** If true, bar is hidden */
  dismissed?: boolean;
}

export default function PrequalifyBar({ steps = DEFAULT_STEPS, dismissed = false }: PrequalifyBarProps) {
  const [hidden, setHidden]   = useState(dismissed);
  const [open, setOpen]       = useState(false);

  if (!FEATURES.PREQUALIFY_FLOW_V2 || hidden) return null;

  const completed = steps.filter((s) => s.done).length;
  const pct       = Math.round((completed / steps.length) * 100);

  return (
    <>
      <div
        role="complementary"
        aria-label="Prequalification progress"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-vt-neutral-800 bg-vt-surface-ops-base px-4 py-3 md:px-8"
      >
        {/* Progress bar fill */}
        <div className="absolute inset-x-0 top-0 h-0.5 bg-vt-neutral-800">
          <div
            className="h-full bg-vt-success transition-all duration-500"
            style={{ width: `${pct}%` }}
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
          />
        </div>

        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          {/* Steps */}
          <div className="flex items-center gap-3 overflow-x-auto">
            {steps.map((s) => (
              <div
                key={s.label}
                className={`flex items-center gap-1.5 whitespace-nowrap tag ${
                  s.done ? 'text-vt-success' : 'text-vt-neutral-800'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${s.done ? 'bg-vt-success' : 'bg-vt-neutral-800'}`} aria-hidden="true" />
                {s.label}
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-vt-success px-4 py-2 text-xs font-semibold text-black hover:bg-vt-success/90 transition"
              aria-haspopup="dialog"
            >
              <Zap className="h-3.5 w-3.5" />
              {completed === 0 ? 'Get Prequalified' : 'Continue'}
            </button>
            <button
              onClick={() => setHidden(true)}
              aria-label="Dismiss prequalification bar"
              className="rounded-full p-1.5 text-vt-neutral-800 hover:bg-vt-surface-ops-raised hover:text-white transition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <PrequalifyModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
