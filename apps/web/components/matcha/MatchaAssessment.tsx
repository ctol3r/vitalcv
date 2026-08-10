'use client';

/**
 * MatchaAssessment — the browsable Personal / Professional / Place match-question surface.
 *
 * Answer as many as you like; the more you answer, the sharper the match. Per-category and
 * overall completeness are real (answered / total). Every question writes straight into the
 * MatchaPreferences spine and updates MATCHA's reasoning live. Honest throughout — the copy
 * says answering improves matching, and only engine-backed fields are labeled as such.
 */

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { useMatchaPreferences } from './useMatchaPreferences';
import { MatchaStepInput } from './MatchaStepInput';
import { MatchaStorageNotice } from './MatchaStorageNotice';
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  allCategoryProgress,
  stepsForCategory,
  type MatchCategory,
} from '@/lib/matcha/categories';

const ACCENT = 'var(--vt-accent, #0A7B7F)';

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div style={{ height: 6, borderRadius: 999, background: 'var(--vt-border, #E2E8E6)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(2, percent)}%`, height: '100%', background: ACCENT, borderRadius: 999, transition: 'width 320ms cubic-bezier(0.2,0.8,0.2,1)' }} />
    </div>
  );
}

export function MatchaAssessment() {
  const { data } = useClinicianMobile();
  const npi = data.workspace?.personProfile?.npi ?? undefined;
  const { preferences, completeness, setField, notice } = useMatchaPreferences(npi);
  const [open, setOpen] = useState<MatchCategory | null>('personal');

  const progress = allCategoryProgress(preferences);
  const totalAnswered = progress.reduce((n, p) => n + p.answered, 0);
  const totalQuestions = progress.reduce((n, p) => n + p.total, 0);

  return (
    <div className="mz mz-paper matcha-enter" style={{ maxWidth: 760, margin: '0 auto', padding: '28px 24px 96px', display: 'grid', gap: 20, minHeight: '100vh' }}>
      {/* Header */}
      <header>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: 'var(--vt-text-primary)' }}>Match questions</h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--vt-text-secondary)', lineHeight: 1.55 }}>
          Answer as many as you like across three areas. The more we know, the sharper your
          matches — and everything you enter stays yours.
        </p>
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}><ProgressBar percent={completeness} /></div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--vt-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {totalAnswered}/{totalQuestions} answered
          </span>
        </div>
      </header>

      {/* "everything you enter stays yours" is true; where it is kept is the part the
          reader cannot see, and it changes what a failed write costs them. */}
      <MatchaStorageNotice notice={notice} />

      {/* Category sections */}
      {CATEGORY_ORDER.map((cat) => {
        const meta = CATEGORY_META[cat];
        const prog = progress.find((p) => p.category === cat)!;
        const steps = stepsForCategory(cat);
        const isOpen = open === cat;
        return (
          <section key={cat} style={{ background: 'var(--vt-surface, #fff)', border: '1px solid var(--vt-border, #E2E8E6)', borderRadius: 16, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : cat)}
              aria-expanded={isOpen}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px', background: 'transparent', border: 0, cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--vt-text-primary)' }}>{meta.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--vt-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{prog.answered}/{prog.total}</span>
                </div>
                <p style={{ margin: '4px 0 10px', fontSize: 13, color: 'var(--vt-text-secondary)' }}>{meta.blurb}</p>
                <ProgressBar percent={prog.percent} />
              </div>
              <ChevronDown size={18} style={{ flex: '0 0 auto', color: 'var(--vt-text-muted)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
            </button>

            {isOpen && (
              <div style={{ borderTop: '1px solid var(--vt-border, #EEF2F0)', padding: '8px 20px 20px' }}>
                {steps.map((step) => (
                  <div key={step.id} style={{ padding: '16px 0', borderBottom: '1px solid var(--vt-border, #F1F5F3)' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--vt-text-primary)' }}>{step.prompt}</span>
                      {step.engineBacked ? (
                        <span style={{ fontSize: 10, fontWeight: 600, color: ACCENT, background: `color-mix(in srgb, ${ACCENT} 10%, transparent)`, padding: '1px 6px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                          affects matches
                        </span>
                      ) : null}
                    </div>
                    <MatchaStepInput step={step} value={preferences[step.field!]} onChange={(v) => setField(step.field!, v)} />
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
