'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { FormEvent } from 'react';

import type { PilotIntakePersona } from '@/lib/pilot-intake/validate';

/**
 * PilotIntakeForm — restyled to the wave1505 form-kit (DG-12.4.1 / DG-6.7).
 * Behavior is unchanged: POST /api/pilot-intake, persona preset from ?persona=,
 * same field names, same status handling, and every data-testid preserved
 * (pilot-intake-form/-success/-submit/-network-error, persona-select,
 * data-preset-persona, data-field-error). Only the styling changed, via a
 * scoped `.wv-form` <style> keyed to the wave1505 paper/ink palette.
 *
 * Design Handoff Reference:
 *   design-handoff/claude-design-2026-07-12-wave1505/wave1505/w1505-contact.jsx
 */

const PERSONA_OPTIONS: ReadonlyArray<{ value: PilotIntakePersona; label: string }> = [
  { value: 'cvo', label: 'CVO / Credentialing Verification Org' },
  { value: 'payer', label: 'Payer / Health Plan' },
  { value: 'staffing_exchange', label: 'Staffing Exchange / Locum Network' },
  { value: 'health_system', label: 'Hospital / Health System' },
  { value: 'individual_clinician', label: 'Individual Clinician' },
  { value: 'other', label: 'Other' },
];

const ALLOWED_PERSONA_VALUES = new Set<PilotIntakePersona>(
  PERSONA_OPTIONS.map((o) => o.value),
);

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; errors: Record<string, string> }
  | { kind: 'network_error' };

const FORM_CSS = `
.wv-form { display: flex; flex-direction: column; gap: 18px; }
.wv-form .fld { display: flex; flex-direction: column; gap: 6px; }
.wv-form label { font-family: var(--font-mono, ui-monospace, monospace); font-size: 11px; font-weight: 600;
  letter-spacing: 0.08em; text-transform: uppercase; color: #474540; }
.wv-form input, .wv-form select, .wv-form textarea {
  width: 100%; box-sizing: border-box; min-height: 46px; padding: 11px 12px;
  font-family: var(--font-body, ui-sans-serif, system-ui, sans-serif); font-size: 14px; color: #141414;
  background: #ffffff; border: 1px solid #141414; border-radius: 2px; }
.wv-form textarea { min-height: 132px; resize: vertical; line-height: 1.55; }
.wv-form input:focus, .wv-form select:focus, .wv-form textarea:focus {
  outline: none; box-shadow: 0 0 0 2px #f4f2ec, 0 0 0 4px #141414; }
.wv-form .err-text { font-family: var(--font-mono, ui-monospace, monospace); font-size: 11px; color: #7a1414; margin: 0; }
.wv-form .submit { width: 100%; min-height: 46px; display: inline-flex; align-items: center; justify-content: center;
  font-family: var(--font-body, ui-sans-serif, system-ui, sans-serif); font-size: 13.5px; font-weight: 500;
  color: #ffffff; background: #047857; border: 1px solid transparent; border-radius: 2px; cursor: pointer; }
.wv-form .submit:hover { background: #059669; }
.wv-form .submit:disabled { background: #dddbd3; color: #6b6860; cursor: not-allowed; }
.wv-form .neterr { margin: 0; padding: 10px 12px; border: 1px dashed #b98a1e; background: #faf3e2;
  border-radius: 2px; font-size: 12.5px; color: #7d5a1e; }
.wv-form .neterr a, .wv-success a { color: #141414; }
.wv-success { border: 1px solid #b6d3c1; background: #eef5f0; border-radius: 4px; padding: 24px; color: #14311f; }
.wv-success h2 { font-family: var(--font-display, Georgia, serif); font-weight: 560; font-size: 20px; margin: 0; }
.wv-success p { margin: 8px 0 0; font-size: 13.5px; line-height: 1.6; color: #1c5c38; }
`;

export function PilotIntakeForm() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const searchParams = useSearchParams();
  const personaFromUrl = searchParams.get('persona');
  const presetPersona =
    personaFromUrl && ALLOWED_PERSONA_VALUES.has(personaFromUrl as PilotIntakePersona)
      ? (personaFromUrl as PilotIntakePersona)
      : '';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: 'submitting' });
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      fullName: data.get('fullName'),
      email: data.get('email'),
      organization: data.get('organization'),
      persona: data.get('persona'),
      description: data.get('description'),
    };

    try {
      const res = await fetch('/api/pilot-intake', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        errors?: Record<string, string>;
      };
      if (res.ok && json.ok) {
        setStatus({ kind: 'success' });
        form.reset();
      } else {
        setStatus({ kind: 'error', errors: json.errors ?? {} });
      }
    } catch {
      setStatus({ kind: 'network_error' });
    }
  }

  if (status.kind === 'success') {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: FORM_CSS }} />
        <div className="wv-success" data-testid="pilot-intake-success" role="status">
          <h2>Thanks — we got it.</h2>
          <p>
            We typically reply within one business day. If you don&rsquo;t hear back
            within 48 hours, email <a className="underline" href="mailto:hello@vitalcv.com">hello@vitalcv.com</a>.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: FORM_CSS }} />
      <form onSubmit={onSubmit} className="wv-form" data-testid="pilot-intake-form" noValidate>
        <Field id="fullName" label="Your full name" error={errorOf(status, 'fullName')}>
          <input id="fullName" name="fullName" type="text" autoComplete="name" required />
        </Field>

        <Field id="email" label="Work email" error={errorOf(status, 'email')}>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </Field>

        <Field id="organization" label="Organization" error={errorOf(status, 'organization')}>
          <input id="organization" name="organization" type="text" autoComplete="organization" required />
        </Field>

        <Field id="persona" label="What kind of organization?" error={errorOf(status, 'persona')}>
          <select
            id="persona"
            name="persona"
            required
            defaultValue={presetPersona}
            data-testid="persona-select"
            data-preset-persona={presetPersona || 'none'}
          >
            <option value="" disabled>
              Choose one
            </option>
            {PERSONA_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <Field id="description" label="What kind of pilot are you considering?" error={errorOf(status, 'description')}>
          <textarea id="description" name="description" required rows={5} />
        </Field>

        {status.kind === 'network_error' && (
          <p className="neterr" role="alert" data-testid="pilot-intake-network-error">
            We couldn&rsquo;t reach the server. Please retry, or email{' '}
            <a className="underline" href="mailto:hello@vitalcv.com">hello@vitalcv.com</a>.
          </p>
        )}

        <button type="submit" disabled={status.kind === 'submitting'} className="submit" data-testid="pilot-intake-submit">
          {status.kind === 'submitting' ? 'Sending…' : 'Send pilot inquiry'}
        </button>
      </form>
    </>
  );
}

function errorOf(status: Status, field: string): string | undefined {
  if (status.kind !== 'error') return undefined;
  return status.errors[field];
}

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}

function Field({ id, label, error, children }: FieldProps) {
  return (
    <div className="fld">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && (
        <p className="err-text" role="alert" data-field-error={id}>
          {error}
        </p>
      )}
    </div>
  );
}
