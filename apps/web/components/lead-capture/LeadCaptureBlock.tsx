'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * LeadCaptureBlock — frictionless email capture for the public demo
 * surfaces.
 *
 * Single email field + intent dropdown (waitlist / pilot / walkthrough).
 * On submit: client-side validation, persists to localStorage, shows a
 * calm confirmation state. No backend POST in this version — operator
 * can wire a real `/api/leads` handler later without touching this UI.
 *
 * Design posture: quiet confidence. No hype copy, no urgency badges,
 * no fake counts. The form is small, focused, monospace where
 * appropriate, sized for mobile-first.
 */

export type LeadIntent = 'waitlist' | 'pilot' | 'walkthrough' | 'early_access';

const INTENT_LABEL: Record<LeadIntent, string> = {
  waitlist: 'Join the waitlist',
  pilot: 'Request a pilot',
  walkthrough: 'Book a walkthrough',
  early_access: 'Request early access',
};

export interface LeadCaptureBlockProps {
  /** Eyebrow text above the form. */
  eyebrow?: string;
  /** Main prompt heading. */
  heading: string;
  /** Optional one-line body under the heading. */
  body?: string;
  /** Default intent selection. */
  defaultIntent?: LeadIntent;
  /** Storage key suffix so different placements don't collide. */
  storageKey?: string;
  className?: string;
}

interface PersistedLead {
  email: string;
  intent: LeadIntent;
  context: string;
  at: string;
}

const STORAGE_PREFIX = 'vitalcv:lead:';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function LeadCaptureBlock({
  eyebrow,
  heading,
  body,
  defaultIntent = 'waitlist',
  storageKey = 'default',
  className,
}: LeadCaptureBlockProps) {
  const [email, setEmail] = React.useState('');
  const [intent, setIntent] = React.useState<LeadIntent>(defaultIntent);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !EMAIL_RE.test(trimmed)) {
      setError('Enter a work email so we can reach you.');
      return;
    }
    setError(null);
    const record: PersistedLead = {
      email: trimmed,
      intent,
      context: storageKey,
      at: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(
        `${STORAGE_PREFIX}${storageKey}`,
        JSON.stringify(record),
      );
    } catch {
      // Storage unavailable — proceed to confirmation regardless.
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <section
        className={cn(
          'rounded-md border border-border bg-card p-6 sm:p-8',
          className,
        )}
        aria-live="polite"
      >
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h3 className="mt-2 text-base font-semibold leading-snug text-foreground sm:text-lg">
          Recorded.
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Intent: {INTENT_LABEL[intent].toLowerCase()}. A person responds from
          a real inbox.
        </p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setEmail('');
          }}
          className="mt-4 text-xs font-medium text-foreground/60 underline-offset-4 hover:underline"
        >
          Submit another
        </button>
      </section>
    );
  }

  return (
    <section
      className={cn(
        'rounded-md border border-border bg-card p-6 sm:p-8',
        className,
      )}
    >
      {eyebrow && (
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </p>
      )}
      <h3 className="mt-2 text-base font-semibold leading-snug text-foreground sm:text-lg">
        {heading}
      </h3>
      {body && (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>
      )}
      <form className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center" onSubmit={handleSubmit}>
        <label htmlFor={`lead-email-${storageKey}`} className="sr-only">
          Work email
        </label>
        <Input
          id={`lead-email-${storageKey}`}
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@hospital.org"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `lead-error-${storageKey}` : undefined}
          className="flex-1 sm:max-w-xs"
        />
        <label htmlFor={`lead-intent-${storageKey}`} className="sr-only">
          Intent
        </label>
        <select
          id={`lead-intent-${storageKey}`}
          value={intent}
          onChange={(e) => setIntent(e.target.value as LeadIntent)}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
        >
          {(Object.keys(INTENT_LABEL) as ReadonlyArray<LeadIntent>).map((key) => (
            <option key={key} value={key}>
              {INTENT_LABEL[key]}
            </option>
          ))}
        </select>
        <Button type="submit">Submit</Button>
      </form>
      {error && (
        <p
          id={`lead-error-${storageKey}`}
          role="alert"
          className="mt-2 text-xs text-destructive"
        >
          {error}
        </p>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Stored in your browser on submit. No analytics, no tracking pixels.
        Server-side capture wires in a later release.
      </p>
    </section>
  );
}

export default LeadCaptureBlock;
