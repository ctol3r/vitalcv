'use client';

/**
 * Pilot request form — client island for /pilot.
 *
 * Submits to /api/pilot-request via fetch and renders the structured
 * confirmation inline so buyers don't get navigated away to a raw JSON
 * response. On error we show the validation reason from the backend.
 *
 * Wave 5 rules:
 *   - No guaranteed/fully-verified/instant-hire language.
 *   - Confirmation explains the next step (within two business days).
 *   - Dead-link-free: hits an actually-registered POST route.
 */

import * as React from 'react';
import { ArrowRight } from 'lucide-react';

interface PilotRequestFormProps {
  sourceContext?: string;
}

type ConfirmationModel = {
  headline: string;
  acknowledgement: string;
  bullets: {
    whatHappensNext: string[];
    whatVitalCvMeasures: string[];
    whatYouProvide: string[];
    outsideCoverage: string[];
  };
  reference: { pilotId: string; submissionHash: string; requestedAt: string };
};

type ApiSuccess = {
  ok: true;
  confirmation: ConfirmationModel;
  message?: string;
};

type ApiFailure = {
  ok: false;
  errors?: Array<{ field: string; reason: string }>;
  message?: string;
};

export function PilotRequestForm({
  sourceContext = '/pilot',
}: PilotRequestFormProps): React.ReactElement {
  const [phase, setPhase] = React.useState<'idle' | 'submitting' | 'ok' | 'error'>('idle');
  const [confirmation, setConfirmation] = React.useState<ConfirmationModel | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setPhase('submitting');
      setErrorMessage(null);

      const form = new FormData(event.currentTarget);
      const payload = {
        organization: String(form.get('organization') ?? ''),
        name: String(form.get('name') ?? ''),
        email: String(form.get('email') ?? ''),
        usecase: String(form.get('usecase') ?? ''),
        sourceContext,
      };

      try {
        const res = await fetch('/api/pilot-request', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const body = (await res.json()) as ApiSuccess | ApiFailure;

        if (res.ok && body.ok) {
          setConfirmation(body.confirmation);
          setPhase('ok');
          return;
        }

        const reason =
          ('message' in body && typeof body.message === 'string' && body.message)
          || (('errors' in body
            && Array.isArray(body.errors)
            && body.errors.length > 0
            && body.errors[0]?.reason)
            || null)
          || 'Could not submit pilot request. Please try again.';
        setErrorMessage(reason);
        setPhase('error');
      } catch {
        setErrorMessage('Network error while submitting pilot request. Please retry.');
        setPhase('error');
      }
    },
    [sourceContext],
  );

  if (phase === 'ok' && confirmation) {
    return (
      <section
        data-testid="pilot-confirmation"
        aria-live="polite"
        className="rounded-[10px] border border-[var(--ok-rule)] bg-[var(--ok-bg)] p-6"
      >
        <p className="mz-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ok)]">
          {confirmation.headline}
        </p>
        <p className="mz-body mt-2 text-[var(--vt-text-primary)]">
          {confirmation.acknowledgement}
        </p>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <ConfirmationList
            title="What happens next"
            items={confirmation.bullets.whatHappensNext}
            testId="confirmation-next"
          />
          <ConfirmationList
            title="What VitalCV measures"
            items={confirmation.bullets.whatVitalCvMeasures}
            testId="confirmation-measures"
          />
          <ConfirmationList
            title="What you provide"
            items={confirmation.bullets.whatYouProvide}
            testId="confirmation-provide"
          />
          <ConfirmationList
            title="Outside current coverage"
            items={confirmation.bullets.outsideCoverage}
            testId="confirmation-outside"
          />
        </div>

        <p className="mz-mono mt-6 text-[11px] text-[var(--vt-text-muted)]">
          Reference: {confirmation.reference.pilotId} · {confirmation.reference.requestedAt}
        </p>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="pilot-request-form">
      <div>
        <label htmlFor="org" className="block text-sm font-medium text-[var(--vt-text-primary)] mb-1.5">
          Organization
        </label>
        <input
          id="org"
          name="organization"
          type="text"
          required
          className="mz-input"
          placeholder="Acme Health System"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-[var(--vt-text-primary)] mb-1.5">
            Contact name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="mz-input"
            placeholder="Jane Smith"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[var(--vt-text-primary)] mb-1.5">
            Work email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="mz-input"
            placeholder="jane@acme.com"
          />
        </div>
      </div>
      <div>
        <label htmlFor="usecase" className="block text-sm font-medium text-[var(--vt-text-primary)] mb-1.5">
          Tell us about your baseline
        </label>
        <textarea
          id="usecase"
          name="usecase"
          rows={3}
          className="mz-input resize-none"
          placeholder="How many days does an application sit before first review today?"
        />
      </div>
      <button
        type="submit"
        disabled={phase === 'submitting'}
        className="mz-btn w-full justify-center mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {phase === 'submitting' ? 'Submitting…' : 'Submit pilot request'}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>

      {phase === 'error' && errorMessage ? (
        <p
          className="mt-3 rounded-[6px] border border-[var(--p0-rule)] bg-[var(--p0-bg)] px-3 py-2 text-sm text-[var(--p0)]"
          role="alert"
          data-testid="pilot-request-error"
        >
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}

function ConfirmationList({
  title,
  items,
  testId,
}: {
  title: string;
  items: string[];
  testId: string;
}): React.ReactElement {
  return (
    <div data-testid={testId}>
      <h4 className="mz-mono text-xs font-semibold uppercase tracking-[0.16em] text-[var(--vt-text-secondary)]">
        {title}
      </h4>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--vt-text-secondary)]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default PilotRequestForm;
