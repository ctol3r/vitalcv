'use client';
/**
 * Wave 189 — Prequalification Status Ribbon
 * Persistent ribbon showing prequalification progress across the holder workspace.
 * Renders as a slim top bar; each step lights up green when complete.
 */

import Link from 'next/link';
import { CheckCircle2, Circle, ChevronRight, Zap } from 'lucide-react';

interface Step {
  key: string;
  label: string;
  done: boolean;
}

interface Props {
  steps?: Step[];
  prequalified?: boolean;
  score?: number;
}

const DEFAULT_STEPS: Step[] = [
  { key: 'resume', label: 'Resume', done: false },
  { key: 'npi', label: 'NPI', done: false },
  { key: 'work_auth', label: 'Work Auth', done: false },
  { key: 'interview', label: 'Interview', done: false },
  { key: 'assessment', label: 'Assessment', done: false },
];

export default function PrequalificationRibbon({
  steps = DEFAULT_STEPS,
  prequalified = false,
  score = 0,
}: Props) {
  if (prequalified) {
    return (
      <div className="w-full flex items-center justify-between px-4 py-2.5 bg-green-900/30 border-b border-green-500/20 text-sm">
        <div className="flex items-center gap-2 text-green-400">
          <Zap className="w-4 h-4" />
          <span className="font-medium">Prequalified — Instant Offer Eligible</span>
        </div>
        <Link href="/holder/opportunities" className="flex items-center gap-1 text-green-400/80 hover:text-green-300 transition-colors text-xs">
          View Matched Roles <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
    );
  }

  const done = steps.filter(s => s.done).length;
  const pct = Math.round((done / steps.length) * 100);

  return (
    <div className="w-full px-4 py-2.5 border-b border-white/8 bg-white/[0.02]">
      <div className="flex items-center gap-4 max-w-5xl mx-auto">
        {/* Progress label */}
        <div className="flex-shrink-0 text-xs text-white/40">
          Prequalification <span className="text-white/60 font-medium">{pct}%</span>
        </div>

        {/* Step dots */}
        <div className="flex items-center gap-2 flex-1 overflow-x-auto">
          {steps.map((step, i) => (
            <div key={step.key} className="flex items-center gap-1 flex-shrink-0">
              {step.done ? (
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-white/20 flex-shrink-0" />
              )}
              <span className={`text-xs ${step.done ? 'text-green-400' : 'text-white/40'}`}>
                {step.label}
              </span>
              {i < steps.length - 1 && (
                <ChevronRight className="w-3 h-3 text-white/15 flex-shrink-0 ml-1" />
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/get-ready"
          className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg bg-blue-600/30 border border-blue-500/30 text-blue-400 hover:bg-blue-600/50 transition-colors"
        >
          Continue
        </Link>
      </div>

      {/* Progress bar */}
      <div className="mt-1.5 max-w-5xl mx-auto h-0.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
