'use client';

/**
 * MatchaStepInput — a controlled input for a single onboarding/assessment step.
 *
 * Renders the right control for the step kind (chips, scale, tags, number, boolean) and reports
 * changes via onChange. Unlike the linear onboarding flow, this does not auto-advance — it's the
 * shared control used by the browsable Personal/Professional/Place assessment.
 */

import { useState } from 'react';
import type { MatchaPreferences, PreferenceField } from '@/lib/matcha/preferences';
import { coerceAnswer, type OnboardingStep } from '@/lib/matcha/onboarding';

const ACCENT = 'var(--vt-accent, #0A7B7F)';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 14,
  borderRadius: 10,
  border: '1px solid var(--vt-border, #D6DED9)',
  background: 'var(--vt-surface, #fff)',
  color: 'var(--vt-text-primary)',
  outline: 'none',
};

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: '8px 13px',
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        border: `1px solid ${active ? ACCENT : 'var(--vt-border, #D6DED9)'}`,
        background: active ? `color-mix(in srgb, ${ACCENT} 12%, transparent)` : 'var(--vt-surface, #fff)',
        color: active ? ACCENT : 'var(--vt-text-primary)',
        transition: 'all 150ms cubic-bezier(0.2,0.8,0.2,1)',
      }}
    >
      {label}
    </button>
  );
}

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  const commit = () => {
    const v = draft.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setDraft('');
  };
  return (
    <div>
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {value.map((tag) => (
            <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 999, background: `color-mix(in srgb, ${ACCENT} 12%, transparent)`, color: ACCENT, fontSize: 12, fontWeight: 500 }}>
              {tag}
              <button type="button" aria-label={`Remove ${tag}`} onClick={() => onChange(value.filter((t) => t !== tag))} style={{ border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
      )}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); } }}
        onBlur={commit}
        placeholder={placeholder ?? 'Type and press Enter'}
        style={inputStyle}
      />
    </div>
  );
}

export interface MatchaStepInputProps {
  step: OnboardingStep;
  value: MatchaPreferences[PreferenceField];
  onChange: (value: MatchaPreferences[PreferenceField]) => void;
}

export function MatchaStepInput({ step, value, onChange }: MatchaStepInputProps) {
  switch (step.kind) {
    case 'boolean':
      return (
        <div style={{ display: 'flex', gap: 8 }}>
          <Chip label="Yes" active={value === true} onClick={() => onChange(true as never)} />
          <Chip label="No" active={value === false} onClick={() => onChange(false as never)} />
        </div>
      );

    case 'scale':
    case 'chips_single':
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {step.options?.map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              active={value === opt.value}
              onClick={() => onChange(opt.value as never)}
            />
          ))}
        </div>
      );

    case 'chips_multi': {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {step.options?.map((opt) => {
            const active = arr.includes(opt.value);
            return (
              <Chip
                key={opt.value}
                label={opt.label}
                active={active}
                onClick={() => onChange((active ? arr.filter((v) => v !== opt.value) : [...arr, opt.value]) as never)}
              />
            );
          })}
        </div>
      );
    }

    case 'tags':
      return (
        <TagInput
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={(v) => onChange(coerceAnswer(step, v))}
          placeholder={step.hint}
        />
      );

    case 'number':
      return (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            inputMode="numeric"
            defaultValue={typeof value === 'number' ? String(value) : ''}
            placeholder={step.numberPlaceholder}
            onBlur={(e) => onChange(coerceAnswer(step, e.target.value))}
            onKeyDown={(e) => { if (e.key === 'Enter') onChange(coerceAnswer(step, (e.target as HTMLInputElement).value)); }}
            style={{ ...inputStyle, maxWidth: 180 }}
          />
          {step.numberUnit ? <span style={{ fontSize: 13, color: 'var(--vt-text-muted)' }}>{step.numberUnit}</span> : null}
        </div>
      );

    default:
      return null;
  }
}
