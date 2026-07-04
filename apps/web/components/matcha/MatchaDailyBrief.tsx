'use client';

/**
 * MatchaDailyBrief — the daily-return hook. Once a day, MATCHA shows what actually moved since the
 * clinician's last visit (new matches, a readiness change, edits they made, saved roles) and a
 * consecutive-day streak. On days they've already seen it, it collapses to a quiet streak line.
 *
 * Every line is a real delta (see lib/matcha/daily.ts + useMatchaDaily). Nothing is fabricated.
 * Styled to the Calm Wave `.mz` aesthetic used by the hub.
 */

import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { useMatchaPreferences } from './useMatchaPreferences';
import { useMatchaOpportunities } from './useMatchaOpportunities';
import { useOpportunityActions } from './useOpportunityActions';
import { useMatchaDaily } from './useMatchaDaily';
import { buildBriefItems, gapNudge, type BriefTone } from '@/lib/matcha/daily';
import { CATEGORY_META, allCategoryProgress } from '@/lib/matcha/categories';

const TONE_DOT: Record<BriefTone, string> = {
  up: 'var(--ok, #1c5c38)',
  nudge: 'var(--watch, #7d5a1e)',
  neutral: 'var(--ink-400, #96938a)',
};

export function MatchaDailyBrief() {
  const { data } = useClinicianMobile();
  const npi = data.workspace?.personProfile?.npi ?? undefined;
  const readinessScore = data.trustState?.readinessScore ?? null;

  const { preferences, completeness, loaded } = useMatchaPreferences(npi);
  const { matches } = useMatchaOpportunities(npi ?? null);
  const { counts } = useOpportunityActions();

  const ids = useMemo(
    () => matches.map((m) => m.opportunity?.id).filter((id): id is string => Boolean(id)),
    [matches],
  );
  const bucketCounts = counts(ids);

  const daily = useMatchaDaily({ ready: loaded, readinessScore, preferences });

  const thinnest = useMemo(() => {
    const progress = allCategoryProgress(preferences).filter((p) => p.percent < 100).sort((a, b) => a.percent - b.percent)[0];
    return progress ? CATEGORY_META[progress.category].label : null;
  }, [preferences]);

  const items = useMemo(
    () =>
      buildBriefItems({
        newMatches: bucketCounts.new,
        savedMatches: bucketCounts.saved,
        readinessScore,
        readinessDelta: daily.readinessDelta,
        completeness,
        memoryNotes: daily.memoryNotes,
        gapNudge: gapNudge(completeness, thinnest),
      }),
    [bucketCounts.new, bucketCounts.saved, readinessScore, daily.readinessDelta, completeness, daily.memoryNotes, thinnest],
  );

  if (!daily.loaded) return null;

  const streakLine =
    daily.streak <= 1 ? 'Welcome back' : `${daily.streak}-day streak`;

  // Collapsed state: they've seen today's brief.
  if (!daily.isNewDay) {
    return (
      <div className="mz-card mz-card-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span className="mz-mono" style={{ fontSize: 12, color: 'var(--ink-600)', letterSpacing: '0.04em' }}>
          {streakLine} · you&rsquo;re up to date
        </span>
        <span className="mz-mono" style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>
          {daily.streak > 1 ? `${daily.streak}🔥` : ''}
        </span>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className="mz-card"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }}
        style={{ overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--rule)' }}>
          <span className="mz-eyebrow">MATCHA today</span>
          <span className="mz-mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-700)', letterSpacing: '0.04em' }}>
            {daily.streak > 1 ? `${daily.streak}-day streak 🔥` : 'Day 1'}
          </span>
        </div>

        {/* What moved */}
        <ul style={{ listStyle: 'none', margin: 0, padding: '14px 20px', display: 'grid', gap: 12 }}>
          {items.map((item, i) => (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.06 * i, ease: [0.2, 0.7, 0.2, 1] }}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}
            >
              <span style={{ width: 7, height: 7, borderRadius: 2, background: TONE_DOT[item.tone], marginTop: 6, flex: '0 0 auto' }} />
              <span style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--ink-800)' }}>{item.text}</span>
            </motion.li>
          ))}
        </ul>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px 18px' }}>
          <a href="/holder/matcha/opportunities" className="mz-btn mz-btn-sm">Open your sky</a>
          <button type="button" className="mz-btn-ghost mz-btn-sm mz-btn" style={{ background: 'transparent' }} onClick={daily.markBriefSeen}>
            Got it
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
