'use client';

/**
 * MatchaHomeActivity — Wave 5, the "living" MATCHA strip on the clinician home.
 *
 * Additive and self-gating: renders nothing unless MATCHA_V2 is on. Every figure is real —
 * learning progress is preference completeness, "recently learned" comes from grounded memory
 * diffing, and the pipeline count is the live opportunity list. Styled to match the calm home
 * surface. No fabricated activity.
 */

import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';
import { FEATURES } from '@/lib/features';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { useMatchaPreferences } from './useMatchaPreferences';

export function MatchaHomeActivity() {
  const { data } = useClinicianMobile();
  const npi = data.workspace?.personProfile?.npi ?? undefined;
  const { completeness, memory, loaded } = useMatchaPreferences(npi);

  if (!FEATURES.MATCHA_V2 || !loaded) return null;

  const pipeline = data.availableOpportunities?.length ?? 0;
  const started = completeness > 0;

  return (
    <section className="mz mz-glass p-5">
      <div className="flex items-start justify-between gap-4">
        <span className="mz-eyebrow">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Matching activity
        </span>
        <Link
          href="/holder/matcha"
          className="inline-flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ color: 'var(--accent)' }}
        >
          {started ? 'Open matches' : 'Open matches'}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {started ? (
        <>
          <div className="mt-4 flex items-center gap-3">
            <div className="mz-meter flex-1">
              <span style={{ width: `${Math.max(4, completeness)}%` }} />
            </div>
            <span className="mz-mono text-sm font-semibold">{completeness}% learned</span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1.4fr_0.6fr]">
            <div className="mz-glass-inset rounded-[8px] px-4 py-3">
              <p className="mz-mono text-[10px] uppercase tracking-[0.16em] opacity-60">Recently learned</p>
              {memory.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {memory.slice(0, 2).map((note, i) => (
                    <li key={`${note.field}-${i}`} className="mz-body">
                      {note.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 mz-small">
                  Keep answering and your matches sharpen. Every answer is yours.
                </p>
              )}
            </div>
            <div className="mz-glass-inset rounded-[8px] px-4 py-3">
              <p className="mz-mono text-[10px] uppercase tracking-[0.16em] opacity-60">Opportunity pipeline</p>
              <p className="mt-2 text-2xl font-semibold mz-mono">{pipeline}</p>
              <p className="mt-1 mz-small">live role{pipeline === 1 ? '' : 's'} in view</p>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-4 max-w-2xl mz-body">
          We learn what you want next, then works in the background to surface roles worth your
          time. A short conversation gets it started.
        </p>
      )}
    </section>
  );
}
