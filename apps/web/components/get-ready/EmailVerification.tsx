'use client';

/**
 * EmailVerification — the identity-binding possession factor on the NPI gate.
 *
 * The clinician proves possession of a work/institutional email via a one-time
 * code. It is honestly framed as a CORROBORATION signal that strengthens the
 * NPI->person binding — never a license or identity verification. Talks to the
 * auth-scoped /api/profile/identity/email-otp/{issue,verify} proxies.
 */

import { useState } from 'react';
import { CheckCircle2, Loader2, Mail, ShieldPlus } from 'lucide-react';

type Step = 'email' | 'sending' | 'code' | 'verifying' | 'verified';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailVerification() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function issue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    setStep('sending');
    try {
      const res = await fetch('/api/profile/identity/email-otp/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Could not send a code. Try again shortly.');
        setStep('email');
        return;
      }
      setStep('code');
    } catch {
      setError('Could not send a code. Try again shortly.');
      setStep('email');
    }
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = code.trim();
    if (!/^\d{6}$/.test(value)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setError(null);
    setStep('verifying');
    try {
      const res = await fetch('/api/profile/identity/email-otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: value }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.verified) {
        setError(body.reason ?? 'Verification failed. Try again.');
        setStep('code');
        return;
      }
      setStep('verified');
    } catch {
      setError('Verification failed. Try again.');
      setStep('code');
    }
  }

  if (step === 'verified') {
    return (
      <div className="rounded-[8px] border border-[var(--ok-rule)] bg-[var(--ok-bg)] p-4 text-left">
        <p className="flex items-center gap-2 text-sm font-semibold text-[var(--ok)]">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Work email verified
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--ink-600)]">
          Recorded as a possession signal that strengthens your identity binding. It
          corroborates your NPI match — it is not a license check.
        </p>
      </div>
    );
  }

  const busy = step === 'sending' || step === 'verifying';

  return (
    <div className="mz-inset p-4 text-left">
      <p className="flex items-center gap-2 text-sm font-semibold text-[var(--ink-900)]">
        <ShieldPlus className="h-4 w-4 text-[var(--ok)]" aria-hidden /> Strengthen your identity
        <span className="ml-auto rounded-full border border-[var(--rule)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--ink-400)]">
          Optional
        </span>
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--ink-500)]">
        Verify a work email to corroborate your NPI match. A possession signal — not a
        license or identity check.
      </p>

      {step === 'code' || step === 'verifying' ? (
        <form onSubmit={verify} className="mt-3 space-y-2" noValidate>
          <p className="text-xs text-[var(--ink-500)]">
            We sent a 6-digit code to <span className="text-[var(--ink-800)]">{email.trim()}</span>.
          </p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={busy}
            aria-label="6-digit verification code"
            className="mz-input font-mono"
          />
          {error ? <p role="alert" className="text-xs text-[var(--p0)]">{error}</p> : null}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="mz-btn mz-btn-sm disabled:opacity-60"
            >
              {step === 'verifying' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              Verify
            </button>
            <button
              type="button"
              onClick={() => { setStep('email'); setCode(''); setError(null); }}
              disabled={busy}
              className="text-xs text-[var(--ink-500)] underline underline-offset-2 hover:text-[var(--ink-800)]"
            >
              Use a different email
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={issue} className="mt-3 space-y-2" noValidate>
          <div className="flex items-center gap-2 rounded-[6px] border border-[var(--ink-300)] bg-[var(--card)] px-3 focus-within:border-[var(--accent)]">
            <Mail className="h-4 w-4 text-[var(--ink-400)]" aria-hidden />
            <input
              type="email"
              autoComplete="email"
              placeholder="you@hospital.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              aria-label="Work email"
              className="w-full bg-transparent py-2 text-sm text-[var(--ink-900)] placeholder:text-[var(--ink-400)] focus:outline-none"
            />
          </div>
          {error ? <p role="alert" className="text-xs text-[var(--p0)]">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="mz-btn mz-btn-ghost mz-btn-sm disabled:opacity-60"
          >
            {step === 'sending' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            Send me a code
          </button>
        </form>
      )}
    </div>
  );
}
