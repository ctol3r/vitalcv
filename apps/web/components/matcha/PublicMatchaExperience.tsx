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
import { ArrowRight, RotateCcw } from 'lucide-react';

import type { MatchaPreferences, PreferenceField } from '@/lib/matcha/preferences';
import { deriveMatchaProfile } from '@/lib/matcha/profile';
import { preferenceMatchReasons } from '@/lib/matcha/opportunityFit';
import { MatchaExplanation } from './MatchaExplanation';
import { useMatchaPreferences } from './useMatchaPreferences';

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
      { value: 'part_time', label: 'Part time' },
      { value: 'per_diem', label: 'Per diem' },
      { value: 'locums', label: 'Locums' },
      { value: 'telehealth', label: 'Telehealth' },
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
      className="mz"
      style={{
        display: 'grid',
        gap: 16,
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        alignItems: 'start',
      }}
    >
      {/* Left: the conversation */}
      <div className="mz-card mz-card-pad" style={{ minHeight: 260 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span className="mz-eyebrow">Try matching</span>
          {answeredCount > 0 ? (
            <button
              type="button"
              onClick={() => { reset(); setIndex(0); }}
              className="mz-mono"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 0, background: 'transparent', color: 'var(--ink-500)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer' }}
            >
              <RotateCcw size={12} /> Reset
            </button>
          ) : null}
        </div>

        <AnimatePresence mode="wait">
          {!done ? (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }}
            >
              <p className="mz-h1" style={{ marginTop: 16, fontSize: 22 }}>{q.prompt}</p>
              {q.multi ? (
                <p className="mz-mono" style={{ margin: '6px 0 0', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-400)' }}>Pick any that apply</p>
              ) : null}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                {q.options.map((opt) => {
                  const v = preferences[q.field];
                  const active = Array.isArray(v) ? (v as string[]).includes(opt.value) : v === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className="mz-opt"
                      aria-pressed={active}
                      onClick={() => answer(q, opt.value)}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {q.multi ? (
                <button
                  type="button"
                  className="mz-btn"
                  style={{ marginTop: 18 }}
                  onClick={() => setIndex((i) => Math.min(i + 1, QUESTIONS.length))}
                >
                  Continue
                </button>
              ) : null}
            </motion.div>
          ) : (
            <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.32 }}>
              <p className="mz-h1" style={{ marginTop: 16, fontSize: 22 }}>
                That&rsquo;s the idea.
              </p>
              <p className="mz-body" style={{ marginTop: 10 }}>
                With your profile, matching keeps learning and works in the background — scoring real
                roles on your source-backed readiness, not just what you typed here.
              </p>
              <Link href="/holder/matcha" className="mz-btn" style={{ marginTop: 18 }}>
                See your matches <ArrowRight size={16} />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right: the live reflection */}
      <div className="mz-card mz-card-pad mz-inset" style={{ minHeight: 260 }}>
        <span className="mz-eyebrow">What we know about you</span>

        {derived.insights.length === 0 ? (
          <p className="mz-body" style={{ marginTop: 16 }}>
            Tap an answer and watch it reflect back — always tied to exactly what you said,
            never guessed.
          </p>
        ) : (
          <>
            <ul style={{ listStyle: 'none', margin: '14px 0 0', padding: 0, display: 'grid', gap: 12 }}>
              {derived.insights.slice(0, 4).map((insight, i) => (
                <motion.li
                  key={`${insight.label}-${i}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
                  style={{ display: 'grid', gap: 3 }}
                >
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-900)' }}>{insight.label}</span>
                  <span className="mz-mono" style={{ fontSize: 10, color: 'var(--ink-500)' }}>
                    because you told us: {insight.provenance.join(', ').replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </span>
                </motion.li>
              ))}
            </ul>

            {exampleReasons.length > 0 ? (
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--rule)' }}>
                <p className="mz-mono" style={{ margin: '0 0 10px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-400)' }}>
                  Example role · illustration only
                </p>
                <MatchaExplanation reasons={exampleReasons} title="Why this would be surfaced" />
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
