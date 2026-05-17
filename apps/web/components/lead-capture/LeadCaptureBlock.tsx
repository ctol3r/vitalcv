'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';

import type { LeadIntent } from '@/lib/leads/persistLead';

/**
 * LeadCaptureBlock — client form posting to /api/leads.
 *
 * Honest framing: this collects an email + intent so an operator can
 * follow up. It does NOT enroll a pilot, grant access, or constitute
 * any verification. Copy must avoid the truth-contract banned phrases
 * and must NOT promise a response window.
 *
 * Data minimization:
 *   - No free-text "message" / "notes" / "description" field. The form
 *     intentionally has no surface that could attract PHI, patient
 *     names, or other sensitive copy.
 *   - showNpiList exposes a single textarea whose contents are
 *     sanitized server-side: only 10-digit NPI-like strings survive,
 *     capped at MAX_SAMPLE_NPIS. Surrounding text is dropped.
 */

const INTENT_OPTIONS: ReadonlyArray<{ value: LeadIntent; label: string }> = [
  { value: 'waitlist', label: 'Join the waitlist' },
  { value: 'pilot', label: 'Start a pilot conversation' },
  { value: 'walkthrough', label: 'Schedule a walkthrough' },
  { value: 'early_access', label: 'Request early access' },
];

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; leadId: string }
  | { kind: 'error'; errors: Record<string, string> }
  | { kind: 'rate_limited'; retryAfterSeconds?: number }
  | { kind: 'network_error' };

export interface LeadCaptureBlockProps {
  source: string;
  defaultIntent?: LeadIntent;
  showNpiList?: boolean;
  heading?: string;
  helperText?: string;
}

export function LeadCaptureBlock({
  source,
  defaultIntent = 'pilot',
  showNpiList = false,
  heading = 'Talk to us',
  helperText = 'We follow up by email — no verification or pilot enrollment is implied by sending this form.',
}: LeadCaptureBlockProps) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: 'submitting' });
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      email: data.get('email'),
      intent: data.get('intent'),
      source,
      npiList: showNpiList ? data.get('npiList') || undefined : undefined,
    };

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        leadId?: string;
        errors?: Record<string, string>;
        retryAfterSeconds?: number;
      };
      if (res.status === 429) {
        setStatus({ kind: 'rate_limited', retryAfterSeconds: json.retryAfterSeconds });
        return;
      }
      if (res.ok && json.ok && json.leadId) {
        setStatus({ kind: 'success', leadId: json.leadId });
        form.reset();
        return;
      }
      setStatus({ kind: 'error', errors: json.errors ?? {} });
    } catch {
      setStatus({ kind: 'network_error' });
    }
  }

  if (status.kind === 'success') {
    return (
      <div
        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900"
        data-testid="lead-capture-success"
        role="status"
      >
        <h2 className="text-base font-semibold">Received.</h2>
        <p className="mt-2 text-sm">
          We&rsquo;ve received your request and will follow up with the
          next useful step. Reference:{' '}
          <code className="rounded bg-emerald-100 px-1 py-0.5 text-xs">
            {status.leadId}
          </code>
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-border p-6"
      data-testid="lead-capture-form"
      data-source={source}
      noValidate
    >
      <div>
        <h2 className="text-base font-semibold">{heading}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{helperText}</p>
      </div>

      <Field id="lead-email" label="Work email" error={errorOf(status, 'email')}>
        <input
          id="lead-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none"
        />
      </Field>

      <Field id="lead-intent" label="What would you like to do?" error={errorOf(status, 'intent')}>
        <select
          id="lead-intent"
          name="intent"
          defaultValue={defaultIntent}
          required
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-foreground focus:outline-none"
        >
          {INTENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      {showNpiList && (
        <Field
          id="lead-npi-list"
          label="Paste a list of NPIs (optional, 10-digit numbers only — anything else is dropped)"
          error={errorOf(status, 'npiList')}
        >
          <textarea
            id="lead-npi-list"
            name="npiList"
            rows={3}
            maxLength={2000}
            placeholder="1234567890, 0987654321&#10;1122334455"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs focus:border-foreground focus:outline-none"
          />
        </Field>
      )}

      {status.kind === 'rate_limited' && (
        <p
          className="rounded-md bg-amber-50 p-3 text-sm text-amber-900"
          role="alert"
          data-testid="lead-capture-rate-limited"
        >
          Too many submissions from this network. Please retry
          {status.retryAfterSeconds ? ` in ${status.retryAfterSeconds}s` : ' shortly'}.
        </p>
      )}

      {status.kind === 'network_error' && (
        <p
          className="rounded-md bg-amber-50 p-3 text-sm text-amber-900"
          role="alert"
          data-testid="lead-capture-network-error"
        >
          We couldn&rsquo;t reach the server. Please retry, or email{' '}
          <a className="underline" href="mailto:hello@vitalcv.com">hello@vitalcv.com</a>.
        </p>
      )}

      <button
        type="submit"
        disabled={status.kind === 'submitting'}
        className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        data-testid="lead-capture-submit"
      >
        {status.kind === 'submitting' ? 'Sending…' : 'Send'}
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
      <label
        htmlFor={id}
        className="block text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
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
