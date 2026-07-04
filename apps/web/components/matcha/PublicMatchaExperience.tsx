'use client';

/**
 * PublicMatchaExperience — a no-signup taste of the MATCHA intelligence layer, embedded on the
 * public homepage. A visitor answers a few quick questions and watches MATCHA reflect back what
 * it understands (with provenance) and how it would explain a fit.
 *
 * Honesty:
 *  - Everything shown is derived from what the visitor just tapped — nothing invented.
 *  - The example role is explicitly labeled as an illustration, not a real match.
 *  - Answers persist to the same local store the signed-in flow uses, so a visitor who then
 *    creates a wallet finds MATCHA already knows them — real continuity, not a reset.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, ArrowRight, RotateCcw } from 'lucide-react';

import type { MatchaPreferences, PreferenceField } from '@/lib/matcha/preferences';
import { deriveMatchaProfile } from '@/lib/matcha/profile';
import { preferenceMatchReasons } from '@/lib/matcha/opportunityFit';
import { MatchaExplanation } from './MatchaExplanation';
import { useMatchaPreferences } from './useMatchaPreferences';

const ACCENT = 'var(--vt-accent, #0A7B7F)';

interface QuickQuestion {
  id: string;
  field: PreferenceField;
  prompt: string;
  multi?: boolean;
  options: Array<{ value: string; label: string }>;
}

// A curated 4-question taste — fast, tap-only, and mapped to real preference fields.
const QUESTIONS: QuickQuestion[] = [
  {
    id: 'specialty',
    field: 'currentSpecialties',
    prompt: 'What do you practice?',
    options: [
      { value: 'Cardiology', label: 'Cardiology' },
      { value: 'Emergency Medicine', label: 'Emergency' },
      { value: 'Family Medicine', label: 'Family med' },
      { value: 'Psychiatry', label: 'Psychiatry' },
      { value: 'Nursing', label: 'Nursing' },
      { value: 'Anesthesiology', label: 'Anesthesiology' },
    ],
  },
  {
    id: 'states',
    field: 'preferredStates',
    prompt: 'Where would you like to work?',
    multi: true,
    options: [
      { value: 'CA', label: 'California' },
      { value: 'TX', label: 'Texas' },
      { value: 'NY', label: 'New York' },
      { value: 'FL', label: 'Florida' },
      { value: 'WA', label: 'Washington' },
      { value: 'IL', label: 'Illinois' },
    ],
  },
  {
    id: 'work-style',
    field: 'employmentTypes',
    prompt: 'How do you want to work?',
    multi: true,
    options: [
      { value: 'full_time', label: 'Full time' },
      { value: 'locums', label: 'Locums' },
      { value: 'telehealth', label: 'Telehealth' },
      { value: 'part_time', label: 'Part time' },
    ],
  },
  {
    id: 'direction',
    field: 'careerDirection',
    prompt: 'Your next move?',
    options: [
      { value: 'deepen clinical practice', label: 'Deepen practice' },
      { value: 'move into leadership', label: 'Leadership' },
      { value: 'shift toward academia', label: 'Academia' },
      { value: 'explore something new', label: 'Something new' },
    ],
  },
];

export function PublicMatchaExperience() {
  const { preferences, setField, reset } = useMatchaPreferences();
  const [index, setIndex] = useState(0);
  const answeredCount = QUESTIONS.filter((q) => {
    const v = preferences[q.field];
    return Array.isArray(v) ? v.length > 0 : Boolean(v);
  }).length;

  const derived = useMemo(() => deriveMatchaProfile(preferences), [preferences]);
  const done = index >= QUESTIONS.length;

  // An explicitly illustrative role — used only to demonstrate how MATCHA explains fit.
  const exampleReasons = useMemo(
    () =>
      preferenceMatchReasons(preferences, {
        state: preferences.preferredStates?.[0],
        specialty: preferences.currentSpecialties?.[0],
        hiringType: preferences.employmentTypes?.includes('locums') ? 'locums' : 'perm',
        remote: preferences.employmentTypes?.includes('telehealth'),
      }),
    [preferences],
  );

  const answer = (q: QuickQuestion, value: string) => {
    if (q.multi) {
      const current = Array.isArray(preferences[q.field]) ? (preferences[q.field] as string[]) : [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      setField(q.field, next as MatchaPreferences[PreferenceField]);
    } else {
      // single-select fields: careerDirection is a string; specialty is stored as a 1-item array
      const stored = q.field === 'currentSpecialties' ? [value] : value;
      setField(q.field, stored as MatchaPreferences[PreferenceField]);
      setIndex((i) => Math.min(i + 1, QUESTIONS.length));
    }
  };

  const q = QUESTIONS[index];

  return (
    <div
      style={{
        display: 'grid',
        gap: 20,
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        alignItems: 'start',
      }}
    >
      {/* Left: the conversation */}
      <div
        style={{
          background: 'var(--vt-surface, #fff)',
          border: '1px solid var(--vt-border, #E2E8E6)',
          borderRadius: 20,
          padding: 24,
          minHeight: 260,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: ACCENT }}>
            <Sparkles size={14} /> Try MATCHA
          </span>
          {answeredCount > 0 ? (
            <button
              type="button"
              onClick={() => { reset(); setIndex(0); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 0, background: 'transparent', color: 'var(--vt-text-muted)', fontSize: 12, cursor: 'pointer' }}
            >
              <RotateCcw size={12} /> Reset
            </button>
          ) : null}
        </div>

        <AnimatePresence mode="wait">
          {!done ? (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <p style={{ margin: '18px 0 0', fontSize: 20, fontWeight: 600, color: 'var(--vt-text-primary)' }}>{q.prompt}</p>
              {q.multi ? (
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--vt-text-muted)' }}>Pick any that apply.</p>
              ) : null}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
                {q.options.map((opt) => {
                  const v = preferences[q.field];
                  const active = Array.isArray(v) ? (v as string[]).includes(opt.value) : v === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => answer(q, opt.value)}
                      style={{
                        padding: '9px 15px',
                        borderRadius: 11,
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: 'pointer',
                        border: `1px solid ${active ? ACCENT : 'var(--vt-border, #D6DED9)'}`,
                        background: active ? `color-mix(in srgb, ${ACCENT} 12%, transparent)` : 'var(--vt-surface, #fff)',
                        color: active ? ACCENT : 'var(--vt-text-primary)',
                        transition: 'all 160ms cubic-bezier(0.2,0.8,0.2,1)',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {q.multi ? (
                <button
                  type="button"
                  onClick={() => setIndex((i) => Math.min(i + 1, QUESTIONS.length))}
                  style={{ marginTop: 18, padding: '9px 18px', borderRadius: 11, border: 0, background: ACCENT, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  Continue
                </button>
              ) : null}
            </motion.div>
          ) : (
            <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
              <p style={{ margin: '18px 0 0', fontSize: 20, fontWeight: 600, color: 'var(--vt-text-primary)' }}>
                That&rsquo;s the idea.
              </p>
              <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.55, color: 'var(--vt-text-secondary)' }}>
                With your wallet, MATCHA keeps learning and works in the background — scoring real
                roles on your source-backed readiness, not just what you typed here.
              </p>
              <Link
                href="/holder/matcha"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 18, padding: '11px 22px', borderRadius: 12, background: ACCENT, color: '#fff', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}
              >
                Let MATCHA work for you <ArrowRight size={16} />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right: the live reflection */}
      <div
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${ACCENT} 7%, var(--vt-surface, #fff)), var(--vt-surface, #fff))`,
          border: `1px solid color-mix(in srgb, ${ACCENT} 22%, transparent)`,
          borderRadius: 20,
          padding: 24,
          minHeight: 260,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: ACCENT }}>
          MATCHA understands you
        </span>

        {derived.insights.length === 0 ? (
          <p style={{ margin: '16px 0 0', fontSize: 14, lineHeight: 1.55, color: 'var(--vt-text-secondary)' }}>
            Tap an answer and watch MATCHA reflect it back — always tied to exactly what you said,
            never guessed.
          </p>
        ) : (
          <>
            <ul style={{ listStyle: 'none', margin: '14px 0 0', padding: 0, display: 'grid', gap: 10 }}>
              {derived.insights.slice(0, 4).map((insight, i) => (
                <motion.li
                  key={`${insight.label}-${i}`}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{ display: 'grid', gap: 2 }}
                >
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--vt-text-primary)' }}>{insight.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--vt-text-muted)' }}>
                    because you told MATCHA: {insight.provenance.join(', ').replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </span>
                </motion.li>
              ))}
            </ul>

            {exampleReasons.length > 0 ? (
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid color-mix(in srgb, ${ACCENT} 18%, transparent)` }}>
                <p style={{ margin: '0 0 10px', fontSize: 11, color: 'var(--vt-text-muted)' }}>
                  Example role · illustration only
                </p>
                <MatchaExplanation reasons={exampleReasons} title="Why MATCHA would surface this" />
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
