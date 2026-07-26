'use client';

/**
 * MatchaOnboarding — Wave 1. A conversation, not a form.
 *
 * Renders ONBOARDING_STEPS one at a time as MATCHA "messages". Each answer flows straight
 * into the preference model via useMatchaPreferences, so MATCHA's reasoning (and the live
 * intent push) updates as you go. Progress is real: it reflects answered preference fields.
 */

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import {
  ONBOARDING_STEPS,
  coerceAnswer,
  type OnboardingStep,
} from '@/lib/matcha/onboarding';
import { useMatchaPreferences } from './useMatchaPreferences';

interface MatchaOnboardingProps {
  npi?: string;
  clinicianName?: string;
  /** Called when the clinician finishes or exits the flow. */
  onComplete?: () => void;
}

const ACCENT = 'var(--vt-accent, #0A7B7F)';

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');
  const commit = () => {
    const v = draft.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setDraft('');
  };
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: value.length ? 10 : 0 }}>
        {value.map((tag) => (
          <span
            key={tag}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 10px',
              borderRadius: 999,
              background: `color-mix(in srgb, ${ACCENT} 12%, transparent)`,
              color: ACCENT,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => onChange(value.filter((t) => t !== tag))}
              style={{ border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        placeholder={placeholder ?? 'Type and press Enter'}
        style={inputStyle}
      />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  fontSize: 15,
  borderRadius: 12,
  border: '1px solid var(--vt-border, #D6DED9)',
  background: 'var(--vt-surface, #fff)',
  color: 'var(--vt-text-primary)',
  outline: 'none',
};

function OptionButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: '10px 16px',
        borderRadius: 12,
        fontSize: 14,
        fontWeight: 500,
        cursor: 'pointer',
        border: `1px solid ${active ? ACCENT : 'var(--vt-border, #D6DED9)'}`,
        background: active ? `color-mix(in srgb, ${ACCENT} 12%, transparent)` : 'var(--vt-surface, #fff)',
        color: active ? ACCENT : 'var(--vt-text-primary)',
        transition: 'all 160ms cubic-bezier(0.2,0.8,0.2,1)',
      }}
    >
      {label}
    </button>
  );
}

export function MatchaOnboarding({ npi, clinicianName, onComplete }: MatchaOnboardingProps) {
  const { preferences, completeness, setField } = useMatchaPreferences(npi);
  const [index, setIndex] = useState(0);
  const [draftMulti, setDraftMulti] = useState<string[]>([]);

  const step = ONBOARDING_STEPS[index] as OnboardingStep | undefined;
  const isLast = index >= ONBOARDING_STEPS.length - 1;

  const answeredValue = step?.field ? preferences[step.field] : undefined;

  const advance = () => {
    setDraftMulti([]);
    if (isLast) {
      onComplete?.();
      return;
    }
    setIndex((i) => Math.min(i + 1, ONBOARDING_STEPS.length - 1));
  };
  const back = () => setIndex((i) => Math.max(0, i - 1));

  const answerAndAdvance = (raw: unknown) => {
    if (step?.field) setField(step.field, coerceAnswer(step, raw));
    advance();
  };

  const progressPct = useMemo(() => {
    // Blend positional progress with real completeness for an honest, moving bar.
    const positional = Math.round(((index + 1) / ONBOARDING_STEPS.length) * 100);
    return Math.max(positional, completeness);
  }, [index, completeness]);

  if (!step) return null;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--vt-border, #E2E8E6)', overflow: 'hidden' }}>
          <div
            style={{
              width: `${progressPct}%`,
              height: '100%',
              background: ACCENT,
              borderRadius: 999,
              transition: 'width 320ms cubic-bezier(0.2,0.8,0.2,1)',
            }}
          />
        </div>
        <span style={{ fontSize: 12, color: 'var(--vt-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {step.section}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {/* MATCHA message */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 20 }}>
            <span
              aria-hidden="true"
              style={{
                flex: '0 0 auto',
                width: 34,
                height: 34,
                borderRadius: 10,
                background: ACCENT,
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              M
            </span>
            <div>
              <p style={{ margin: 0, fontSize: 19, fontWeight: 600, color: 'var(--vt-text-primary)', lineHeight: 1.35 }}>
                {step.prompt}
              </p>
              {step.hint ? (
                <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--vt-text-muted)', lineHeight: 1.5 }}>{step.hint}</p>
              ) : null}
              {step.engineBacked ? (
                <span
                  style={{
                    display: 'inline-block',
                    marginTop: 8,
                    fontSize: 11,
                    fontWeight: 600,
                    color: ACCENT,
                    background: `color-mix(in srgb, ${ACCENT} 10%, transparent)`,
                    padding: '2px 8px',
                    borderRadius: 999,
                  }}
                >
                  Updates your live matches
                </span>
              ) : null}
            </div>
          </div>

          {/* Answer control */}
          <div style={{ paddingLeft: 46 }}>
            {step.kind === 'intro' && (
              <button type="button" onClick={advance} style={primaryBtn}>
                {clinicianName ? `Let's go, ${clinicianName}` : "Let's go"}
              </button>
            )}

            {step.kind === 'boolean' && (
              <div style={{ display: 'flex', gap: 10 }}>
                <OptionButton label="Yes" active={answeredValue === true} onClick={() => answerAndAdvance(true)} />
                <OptionButton label="No" active={answeredValue === false} onClick={() => answerAndAdvance(false)} />
              </div>
            )}

            {(step.kind === 'chips_single' || step.kind === 'scale') && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {step.options?.map((opt) => (
                  <OptionButton
                    key={opt.value}
                    label={opt.label}
                    active={answeredValue === opt.value}
                    onClick={() => answerAndAdvance(opt.value)}
                  />
                ))}
              </div>
            )}

            {step.kind === 'chips_multi' && (
              <div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {step.options?.map((opt) => {
                    const active = draftMulti.includes(opt.value);
                    return (
                      <OptionButton
                        key={opt.value}
                        label={opt.label}
                        active={active}
                        onClick={() =>
                          setDraftMulti((prev) =>
                            prev.includes(opt.value) ? prev.filter((v) => v !== opt.value) : [...prev, opt.value],
                          )
                        }
                      />
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => answerAndAdvance(draftMulti)}
                  disabled={draftMulti.length === 0}
                  style={{ ...primaryBtn, marginTop: 16, opacity: draftMulti.length === 0 ? 0.5 : 1 }}
                >
                  Continue
                </button>
              </div>
            )}

            {step.kind === 'tags' && (
              <div>
                <TagInput
                  value={Array.isArray(answeredValue) ? (answeredValue as string[]) : []}
                  onChange={(next) => step.field && setField(step.field, coerceAnswer(step, next))}
                  placeholder={step.hint}
                />
                <button type="button" onClick={advance} style={{ ...primaryBtn, marginTop: 16 }}>
                  Continue
                </button>
              </div>
            )}

            {step.kind === 'number' && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  inputMode="numeric"
                  defaultValue={typeof answeredValue === 'number' ? String(answeredValue) : ''}
                  placeholder={step.numberPlaceholder}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') answerAndAdvance((e.target as HTMLInputElement).value);
                  }}
                  id={`num-${step.id}`}
                  style={{ ...inputStyle, maxWidth: 200 }}
                />
                {step.numberUnit ? <span style={{ fontSize: 13, color: 'var(--vt-text-muted)' }}>{step.numberUnit}</span> : null}
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById(`num-${step.id}`) as HTMLInputElement | null;
                    answerAndAdvance(el?.value ?? '');
                  }}
                  style={primaryBtn}
                >
                  Continue
                </button>
              </div>
            )}

            {/* Nav row */}
            <div style={{ display: 'flex', gap: 16, marginTop: 20, alignItems: 'center' }}>
              {index > 0 && (
                <button type="button" onClick={back} style={ghostBtn}>
                  Back
                </button>
              )}
              {step.kind !== 'intro' && (step.optional || step.kind === 'scale' || step.kind === 'chips_single' || step.kind === 'boolean') && (
                <button type="button" onClick={advance} style={ghostBtn}>
                  {isLast ? 'Finish' : 'Skip'}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: '11px 22px',
  borderRadius: 12,
  border: 0,
  background: ACCENT,
  color: '#fff',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  padding: '8px 4px',
  border: 0,
  background: 'transparent',
  color: 'var(--vt-text-muted)',
  fontSize: 14,
  cursor: 'pointer',
};
