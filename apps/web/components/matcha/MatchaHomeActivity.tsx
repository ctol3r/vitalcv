'use client';

/**
 * MatchaHomeActivity — Wave 5, the "living" MATCHA strip on the clinician home.
 *
 * Additive and self-gating: renders nothing unless MATCHA_V2 is on. Every figure is real —
 * learning progress is preference completeness, "recently learned" comes from grounded memory
 * diffing, and the pipeline count is the live opportunity list. Styled to match the dark home
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
    <section className="rounded-[28px] border border-emerald-400/20 bg-gradient-to-br from-emerald-400/10 to-sky-400/[0.06] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
      <div className="flex items-start justify-between gap-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100">
          <Sparkles className="h-3.5 w-3.5" />
          MATCHA activity
        </div>
        <Link
          href="/holder/matcha"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-100 transition hover:text-white"
        >
          {started ? 'Open MATCHA' : 'Meet MATCHA'}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {started ? (
        <>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400 transition-[width] duration-500"
                style={{ width: `${Math.max(4, completeness)}%` }}
              />
            </div>
            <span className="text-sm font-semibold tabular-nums text-white">{completeness}% learned</span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1.4fr_0.6fr]">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">Recently learned</p>
              {memory.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {memory.slice(0, 2).map((note, i) => (
                    <li key={`${note.field}-${i}`} className="text-sm leading-6 text-white/80">
                      {note.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Keep answering and MATCHA sharpens your matches. Every answer is yours.
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">Opportunity pipeline</p>
              <p className="mt-2 text-2xl font-semibold text-white tabular-nums">{pipeline}</p>
              <p className="mt-1 text-xs text-white/50">live role{pipeline === 1 ? '' : 's'} in view</p>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-4 max-w-2xl text-sm leading-6 text-white/70">
          MATCHA learns what you want next, then works in the background to surface roles worth your
          time. A short conversation gets it started.
        </p>
      )}
    </section>
  );
}
