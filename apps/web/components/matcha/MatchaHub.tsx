'use client';

/**
 * MatchaHub — the signed-in home for the intelligence layer. Ties together Wave 2
 * ("MATCHA understands you"), Wave 10 ("MATCHA remembers"), and entry points to onboarding
 * and opportunities. Reads the clinician's NPI/name from the shared holder provider.
 */

import Link from 'next/link';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { useMatchaPreferences } from './useMatchaPreferences';
import { MatchaProfile } from './MatchaProfile';
import { CATEGORY_META, CATEGORY_ORDER, allCategoryProgress } from '@/lib/matcha/categories';

const ACCENT = 'var(--vt-accent, #0A7B7F)';

export function MatchaHub() {
  const { data } = useClinicianMobile();
  const person = data.workspace?.personProfile;
  const npi = person?.npi ?? undefined;
  const firstName = person?.firstName ?? undefined;

  const { preferences, derived, completeness, memory, loaded } = useMatchaPreferences(npi);
  const categoryProgress = allCategoryProgress(preferences);

  const started = completeness > 0;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 20px 96px', display: 'grid', gap: 24 }}>
      {/* Recently learned — Wave 10 */}
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
            MATCHA remembers
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

      {/* Onboarding CTA */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          background: 'var(--vt-surface, #fff)',
          border: '1px solid var(--vt-border, #E2E8E6)',
          borderRadius: 16,
          padding: 20,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--vt-text-primary)' }}>
            {started ? 'Keep teaching MATCHA' : 'Meet MATCHA'}
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--vt-text-secondary)', maxWidth: 520, lineHeight: 1.5 }}>
            {started
              ? `You've shared ${completeness}% of your preferences. Each answer sharpens the roles MATCHA surfaces for you.`
              : 'A short conversation about what you want next. MATCHA uses it to work in the background on your behalf.'}
          </p>
        </div>
        <Link
          href="/holder/matcha/onboarding"
          style={{
            padding: '11px 22px',
            borderRadius: 12,
            background: ACCENT,
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {started ? 'Continue' : 'Start'}
        </Link>
      </div>

      {/* Match questions — Personal / Professional / Place */}
      <div style={{ background: 'var(--vt-surface, #fff)', border: '1px solid var(--vt-border, #E2E8E6)', borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--vt-text-primary)' }}>Match questions</h2>
          <Link href="/holder/matcha/assessment" style={{ fontSize: 13, fontWeight: 600, color: ACCENT, textDecoration: 'none' }}>
            Answer more →
          </Link>
        </div>
        <p style={{ margin: '6px 0 14px', fontSize: 13, color: 'var(--vt-text-secondary)' }}>
          The more you answer across these three areas, the sharper MATCHA&rsquo;s matches.
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
      </div>

      {/* Wave 2 profile */}
      <MatchaProfile derived={derived} clinicianName={firstName} />

      {/* Link to intelligence opportunities */}
      {started && (
        <Link
          href="/holder/matcha/opportunities"
          style={{
            textAlign: 'center',
            padding: '14px 18px',
            borderRadius: 12,
            border: `1px solid ${ACCENT}`,
            color: ACCENT,
            fontWeight: 600,
            fontSize: 15,
            textDecoration: 'none',
          }}
        >
          See opportunities MATCHA found for you →
        </Link>
      )}
    </div>
  );
}
