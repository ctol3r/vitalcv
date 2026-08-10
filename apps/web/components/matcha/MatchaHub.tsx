'use client';

/**
 * MatchaHub — the signed-in MATCHA dashboard. Ties together the greeting, honest "what to do
 * next", the opportunity snapshot (New/Saved/Connected/Declined + top matches), the match-question
 * categories, "MATCHA understands you" (profile), and "MATCHA remembers" (memory). Every figure is
 * real — completeness, category progress, action counts, and engine match scores.
 */

import Link from 'next/link';
import { useMemo } from 'react';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { useMatchaPreferences } from './useMatchaPreferences';
import { useMatchaOpportunities } from './useMatchaOpportunities';
import { useOpportunityActions } from './useOpportunityActions';
import { MatchaProfile } from './MatchaProfile';
import { MatchaStorageNotice, MatchaUnboundPreferencesPrompt } from './MatchaStorageNotice';
import { MatchaDailyBrief } from './MatchaDailyBrief';
import { CareerEvidenceTimeline } from '@/components/artifacts/CareerEvidenceTimeline';
import { OpportunityCard } from './OpportunityCard';
import { CATEGORY_META, CATEGORY_ORDER, allCategoryProgress } from '@/lib/matcha/categories';
import { deriveNextActions } from '@/lib/matcha/nextActions';
import { BUCKET_LABEL, BUCKET_ORDER } from '@/lib/matcha/opportunityActions';
import { preferenceMatchReasons } from '@/lib/matcha/opportunityFit';
import { countAnsweredFields } from '@/lib/matcha/preferences';

const ACCENT = 'var(--vt-accent, #0A7B7F)';

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--vt-surface, #fff)', border: '1px solid var(--vt-border, #E2E8E6)', borderRadius: 16, padding: 20 }}>
      {children}
    </div>
  );
}

export function MatchaHub() {
  const { data } = useClinicianMobile();
  const person = data.workspace?.personProfile;
  const npi = person?.npi ?? undefined;
  const firstName = person?.firstName ?? undefined;

  const {
    preferences,
    derived,
    completeness,
    memory,
    loaded,
    notice,
    unboundDevicePreferences,
    adoptDevicePreferences,
    dismissDevicePreferences,
  } = useMatchaPreferences(npi);
  const categoryProgress = allCategoryProgress(preferences);

  const { matches, state: oppState } = useMatchaOpportunities(npi ?? null);
  const { loaded: actionsLoaded, bucketOf, setStatus, counts } = useOpportunityActions(npi);

  const oppIds = useMemo(
    () => matches.map((m) => m.opportunity?.id).filter((id): id is string => Boolean(id)),
    [matches],
  );
  const bucketCounts = counts(oppIds);

  const nextActions = deriveNextActions({
    hasNpi: Boolean(npi),
    completeness,
    categories: categoryProgress,
    newMatches: bucketCounts.new,
    savedMatches: bucketCounts.saved,
  });

  const topMatches = useMemo(
    () =>
      [...matches]
        .filter((m) => m.opportunity?.id)
        .sort((a, b) => (b.explanation?.matchScore ?? 0) - (a.explanation?.matchScore ?? 0))
        .slice(0, 2),
    [matches],
  );

  const started = completeness > 0;
  const hasMatches = oppState === 'ready' && matches.length > 0;

  return (
    <div className="mz mz-paper matcha-enter" style={{ maxWidth: 960, margin: '0 auto', padding: '28px 24px 96px', display: 'grid', gap: 24, minHeight: '100vh' }}>
      {/* Daily brief — the come-back-every-day hook */}
      <MatchaDailyBrief />

      {/* Greeting + what to do next */}
      <Panel>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, color: 'var(--vt-text-primary)', letterSpacing: '-0.01em' }}>
          {firstName ? `Welcome back, ${firstName}.` : 'Welcome to matching.'}
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--vt-text-secondary)', lineHeight: 1.5 }}>
          {started
            ? `You've shared ${completeness}% of the preferences we can use — self-reported, not a readiness measure. Here's where to take it next.`
            : "Let's get matching working for you — a few answers is all it takes to start."}
        </p>
        <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {nextActions.map((a) => (
            <Link
              key={a.id}
              href={a.href}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
                border: `1px solid ${a.primary ? ACCENT : 'var(--vt-border, #D6DED9)'}`,
                background: a.primary ? ACCENT : 'var(--vt-surface, #fff)',
                color: a.primary ? '#fff' : 'var(--vt-text-primary)',
              }}
            >
              {a.label} →
            </Link>
          ))}
        </div>
      </Panel>

      {/* Where these answers actually live — carried next to the completeness figure
          above, which otherwise reads as a durable account record in every case. */}
      <MatchaStorageNotice notice={notice} />
      <MatchaUnboundPreferencesPrompt
        answeredCount={
          unboundDevicePreferences ? countAnsweredFields(unboundDevicePreferences) : 0
        }
        onAdopt={adoptDevicePreferences}
        onDismiss={dismissDevicePreferences}
      />

      {/* The career, as a ruled document.
          This was a constellation captioned "built from your real evidence" —
          but it was passed no events, only a specialty, a score and a match
          count, so it drew the fixed illustrative sky with three labels
          swapped. The hub does not hold a clinician's career HISTORY; that
          lives in the profile. So the drawing now says what it is, and the
          adjacent line points at where the real record actually is. */}
      {started && (
        <div>
          <p className="mz-eyebrow" style={{ marginBottom: 10 }}>Your career, end to end</p>
          <div className="vt-artifact">
            <CareerEvidenceTimeline />
          </div>
          <p className="mz-mono" style={{ marginTop: 8, fontSize: 10, color: 'var(--ink-400)' }}>
            Your real evidence lives in your profile.
          </p>
        </div>
      )}

      {/* Recently learned — memory */}
      {loaded && memory.length > 0 && (
        <div
          style={{
            background: `color-mix(in srgb, ${ACCENT} 6%, var(--vt-surface, #fff))`,
            border: `1px solid color-mix(in srgb, ${ACCENT} 24%, transparent)`,
            borderRadius: 16,
            padding: '14px 18px',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: ACCENT }}>
            What we remember
          </div>
          <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'grid', gap: 4 }}>
            {memory.map((note, i) => (
              <li key={`${note.field}-${i}`} style={{ fontSize: 14, color: 'var(--vt-text-primary)' }}>
                {note.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Opportunity snapshot — counters + top matches */}
      {hasMatches && actionsLoaded && (
        <Panel>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--vt-text-primary)' }}>Your opportunities</h2>
            <Link href="/holder/matcha/opportunities" style={{ fontSize: 13, fontWeight: 600, color: ACCENT, textDecoration: 'none' }}>
              View all →
            </Link>
          </div>
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {BUCKET_ORDER.map((b) => (
              <div key={b} style={{ border: '1px solid var(--vt-border, #E2E8E6)', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--vt-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{bucketCounts[b]}</div>
                <div style={{ fontSize: 11, color: 'var(--vt-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{BUCKET_LABEL[b]}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
            {topMatches.map((m, i) => {
              const opp = m.opportunity!;
              return (
                <OpportunityCard
                  key={opp.id ?? i}
                  opportunity={opp}
                  explanation={m.explanation}
                  preferenceReasons={preferenceMatchReasons(preferences, opp)}
                  bucket={bucketOf(opp.id)}
                  onSetStatus={(status) => setStatus(opp.id, status)}
                  npi={npi}
                  detailHref={`/holder/opportunities/${encodeURIComponent(opp.id)}`}
                />
              );
            })}
          </div>
        </Panel>
      )}

      {/* Match questions — Personal / Professional / Place */}
      <Panel>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--vt-text-primary)' }}>Match questions</h2>
          <Link href="/holder/matcha/assessment" style={{ fontSize: 13, fontWeight: 600, color: ACCENT, textDecoration: 'none' }}>
            Answer more →
          </Link>
        </div>
        <p style={{ margin: '6px 0 14px', fontSize: 13, color: 'var(--vt-text-secondary)' }}>
          The more you answer across these three areas, the sharper your matches.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {CATEGORY_ORDER.map((cat) => {
            const prog = categoryProgress.find((p) => p.category === cat)!;
            return (
              <Link
                key={cat}
                href="/holder/matcha/assessment"
                style={{ display: 'block', textDecoration: 'none', border: '1px solid var(--vt-border, #E2E8E6)', borderRadius: 12, padding: '14px 16px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--vt-text-primary)' }}>{CATEGORY_META[cat].label}</span>
                  <span style={{ fontSize: 12, color: 'var(--vt-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{prog.answered}/{prog.total}</span>
                </div>
                <div style={{ marginTop: 10, height: 5, borderRadius: 999, background: 'var(--vt-border, #E2E8E6)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(2, prog.percent)}%`, height: '100%', background: ACCENT, borderRadius: 999 }} />
                </div>
              </Link>
            );
          })}
        </div>
      </Panel>

      {/* MATCHA understands you — profile */}
      <MatchaProfile derived={derived} clinicianName={firstName} />

      {!started && (
        <Link
          href="/holder/matcha/onboarding"
          style={{ textAlign: 'center', padding: '14px 18px', borderRadius: 12, background: ACCENT, color: '#fff', fontWeight: 600, fontSize: 15, textDecoration: 'none' }}
        >
          Start matching →
        </Link>
      )}
    </div>
  );
}
