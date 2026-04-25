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
        className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-6"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-500">
          {confirmation.headline}
        </p>
        <p className="mt-2 text-base text-foreground/90">
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

        <p className="mt-6 font-mono text-[11px] text-muted-foreground">
          Reference: {confirmation.reference.pilotId} · {confirmation.reference.requestedAt}
        </p>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="pilot-request-form">
      <div>
        <label htmlFor="org" className="block text-sm font-medium text-foreground mb-1.5">
          Organization
        </label>
        <input
          id="org"
          name="organization"
          type="text"
          required
          className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
          placeholder="Acme Health System"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1.5">
            Contact name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
            placeholder="Jane Smith"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
            Work email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
            placeholder="jane@acme.com"
          />
        </div>
      </div>
      <div>
        <label htmlFor="usecase" className="block text-sm font-medium text-foreground mb-1.5">
          Tell us about your baseline
        </label>
        <textarea
          id="usecase"
          name="usecase"
          rows={3}
          className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
          placeholder="How many days does an application sit before first review today?"
        />
      </div>
      <button
        type="submit"
        disabled={phase === 'submitting'}
        className="w-full mt-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm inline-flex items-center justify-center gap-2"
      >
        {phase === 'submitting' ? 'Submitting…' : 'Submit pilot request'}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>

      {phase === 'error' && errorMessage ? (
        <p
          className="mt-3 rounded-lg border border-red-300 bg-red-50/70 px-3 py-2 text-sm text-red-800"
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
      <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/80">
        {title}
      </h4>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default PilotRequestForm;
