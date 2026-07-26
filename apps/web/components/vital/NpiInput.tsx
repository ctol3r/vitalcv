'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle2, Fingerprint } from 'lucide-react';

import { checkNpi, npiDigits, type NpiCheck } from '@/lib/vital/npi';

/**
 * NpiInput — the one shared NPI control (homepage, onboarding, employer setup,
 * public lookup, reviewer request, search). Ten visual cells backed by a single
 * accessible <input>; numeric keyboard; live digit count; CMS check-digit
 * validation before the CTA enables; error state carries an icon + text (never
 * color alone); and the "public identifier — not PHI" reassurance is built in.
 */
export interface NpiInputProps {
  defaultValue?: string;
  onChange?: (check: NpiCheck) => void;
  onValid?: (npi: string) => void;
  /** Fires on Enter when the current value is a valid NPI. */
  onSubmitValid?: (npi: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  /** Accessible label for the underlying input. */
  label?: string;
  id?: string;
  className?: string;
}

export function NpiInput({
  defaultValue = '',
  onChange,
  onValid,
  onSubmitValid,
  autoFocus,
  disabled,
  label = 'National Provider Identifier (10 digits)',
  id = 'npi',
  className,
}: NpiInputProps) {
  const [digits, setDigits] = React.useState(() => npiDigits(defaultValue));
  const [focused, setFocused] = React.useState(false);
  const [touched, setTouched] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const lastValidRef = React.useRef<string | null>(null);

  const check = checkNpi(digits);
  const showError = touched && (check.validity === 'bad_checksum' || check.validity === 'not_numeric');
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;

  const update = (raw: string) => {
    const next = npiDigits(raw);
    setDigits(next);
    const c = checkNpi(next);
    onChange?.(c);
    if (c.validity === 'valid' && c.npi && lastValidRef.current !== c.npi) {
      lastValidRef.current = c.npi;
      onValid?.(c.npi);
    } else if (c.validity !== 'valid') {
      lastValidRef.current = null;
    }
  };

  const cells = Array.from({ length: 10 }, (_, i) => digits[i] ?? '');
  const caretIndex = focused ? Math.min(digits.length, 9) : -1;

  return (
    <div className={className}>
      <div
        onClick={() => inputRef.current?.focus()}
        className="relative flex cursor-text items-center gap-3 rounded-[8px] border bg-[var(--vt-bg)] px-3 py-3 transition-colors"
        style={{
          borderColor: showError
            ? 'var(--vt-state-blocked, #b3261e)'
            : focused
              ? 'var(--vt-text-primary)'
              : 'var(--vt-border)',
        }}
      >
        <Fingerprint size={18} aria-hidden="true" className="shrink-0 text-[var(--vt-text-muted)]" />
        {/* Visual cells (decorative — the real value lives in the input). */}
        <div className="flex flex-1 items-center gap-1.5" aria-hidden="true">
          {cells.map((d, i) => (
            <span
              key={i}
              className="flex h-9 flex-1 items-center justify-center rounded-[4px] border text-[16px] font-semibold tabular-nums"
              style={{
                borderColor: i === caretIndex ? 'var(--vt-text-primary)' : 'var(--vt-border)',
                color: 'var(--vt-text-primary)',
                backgroundColor: d ? 'var(--vt-surface-subtle)' : 'transparent',
              }}
            >
              {d || (i === caretIndex ? <span className="h-4 w-px animate-pulse bg-[var(--vt-text-primary)]" /> : '')}
            </span>
          ))}
        </div>
        {check.validity === 'valid' && (
          <CheckCircle2 size={20} aria-hidden="true" className="shrink-0 text-[var(--vt-accent-emerald)]" />
        )}
        {/* One accessible input, visually transparent, over the cells. */}
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label={label}
          aria-invalid={showError}
          aria-describedby={showError ? `${errId} ${hintId}` : hintId}
          autoFocus={autoFocus}
          disabled={disabled}
          value={digits}
          onChange={(e) => update(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setTouched(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && check.validity === 'valid' && check.npi) {
              onSubmitValid?.(check.npi);
            }
          }}
          className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent outline-none"
        />
      </div>

      {/* Count + PHI reassurance + color-independent error */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
        {showError ? (
          <span id={errId} role="alert" className="inline-flex items-center gap-1.5 font-medium text-[var(--vt-state-blocked,#b3261e)]">
            <AlertTriangle size={13} aria-hidden="true" />
            {check.reason}
          </span>
        ) : (
          <span className="tabular-nums text-[var(--vt-text-muted)]">{digits.length}/10 digits</span>
        )}
        <span className="text-[var(--vt-border)]" aria-hidden="true">
          ·
        </span>
        <span id={hintId} className="text-[var(--vt-text-muted)]">
          Your NPI is a public identifier — not PHI.
        </span>
      </div>
    </div>
  );
}

export default NpiInput;
