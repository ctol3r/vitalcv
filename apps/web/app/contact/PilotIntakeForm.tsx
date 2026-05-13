'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { FormEvent } from 'react';

import type { PilotIntakePersona } from '@/lib/pilot-intake/validate';

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
      <div
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900"
        data-testid="pilot-intake-success"
        role="status"
      >
        <h2 className="text-base font-semibold">Thanks — we got it.</h2>
        <p className="mt-2 text-sm">
          We typically reply within one business day. If you don&rsquo;t hear back
          within 48 hours, email <a className="underline" href="mailto:hello@vitalcv.com">hello@vitalcv.com</a>.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4"
      data-testid="pilot-intake-form"
      noValidate
    >
      <Field
        id="fullName"
        label="Your full name"
        error={errorOf(status, 'fullName')}
      >
        <input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          required
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none"
        />
      </Field>

      <Field id="email" label="Work email" error={errorOf(status, 'email')}>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none"
        />
      </Field>

      <Field
        id="organization"
        label="Organization"
        error={errorOf(status, 'organization')}
      >
        <input
          id="organization"
          name="organization"
          type="text"
          autoComplete="organization"
          required
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none"
        />
      </Field>

      <Field
        id="persona"
        label="What kind of organization?"
        error={errorOf(status, 'persona')}
      >
        <select
          id="persona"
          name="persona"
          required
          defaultValue={presetPersona}
          data-testid="persona-select"
          data-preset-persona={presetPersona || 'none'}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none"
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

      <Field
        id="description"
        label="What kind of pilot are you considering?"
        error={errorOf(status, 'description')}
      >
        <textarea
          id="description"
          name="description"
          required
          rows={5}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none"
        />
      </Field>

      {status.kind === 'network_error' && (
        <p
          className="rounded-md bg-amber-50 p-3 text-sm text-amber-900"
          role="alert"
          data-testid="pilot-intake-network-error"
        >
          We couldn&rsquo;t reach the server. Please retry, or email{' '}
          <a className="underline" href="mailto:hello@vitalcv.com">hello@vitalcv.com</a>.
        </p>
      )}

      <button
        type="submit"
        disabled={status.kind === 'submitting'}
        className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        data-testid="pilot-intake-submit"
      >
        {status.kind === 'submitting' ? 'Sending…' : 'Send pilot inquiry'}
      </button>
    </form>
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
    <div>
      <label htmlFor={id} className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
      {error && (
        <p
          className="mt-1 text-xs text-red-600"
          role="alert"
          data-field-error={id}
        >
          {error}
        </p>
      )}
    </div>
  );
}
