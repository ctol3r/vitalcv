'use client';

import React from 'react';

/**
 * RequestReviewPanel — Employer-initiated org context creation.
 *
 * Flow:
 *   1. Employer enters clinician NPI
 *   2. POST /api/request-review → backend creates vcvOrganizationContext
 *   3. Returns a review link: /review/[entityId]?contextId=[contextId]
 *   4. Employer copies link and sends to clinician (or opens directly)
 *
 * Auth: requires employer workspace sign-in.
 * If not signed in, shows a clear sign-in prompt.
 */

import { useState, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { TrustStateCard } from '@/components/trust/TrustStateCard';
import { useRoleContext } from '@/components/auth/RoleContext';
import {
  CLERK_PROVIDER_ENABLED,
  CLERK_SIGN_IN_URL,
} from '@/lib/auth/clerkConfig';

interface ReviewRequestResult {
  contextId: string;
  entityId: string;
  reviewUrl: string;
  npi: string;
  displayName: string | null;
  status: string;
}

type Phase = 'idle' | 'loading' | 'done' | 'error';

export function RequestReviewPanel() {
  const [npi, setNpi] = useState('');
  const [npiError, setNpiError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<ReviewRequestResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const autoTriggered = useRef(false);

  const { isLoaded, isSignedIn } = useRoleContext();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = npi.trim();
    if (!/^\d{10}$/.test(trimmed)) {
      setNpiError('Enter a valid 10-digit NPI.');
      return;
    }
    setNpiError(null);
    setPhase('loading');
    setResult(null);
    setErrorMsg(null);
    setCopied(false);

    try {
      const res = await fetch('/api/request-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npi: trimmed }),
      });

      const data = await res.json() as ReviewRequestResult & { error?: string; hint?: string };

      if (!res.ok) {
        const msg = data.error ?? 'Could not create review context.';
        const hint = data.hint ? `\n${data.hint}` : '';
        setErrorMsg(msg + hint);
        setPhase('error');
        return;
      }

      setResult(data);
      setPhase('done');
    } catch {
      setErrorMsg('Request failed. Check your connection and try again.');
      setPhase('error');
    }
  }

  async function handleCopy() {
    if (!result?.reviewUrl) return;
    try {
      await navigator.clipboard.writeText(result.reviewUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback: select the text
    }
  }

  function handleReset() {
    setPhase('idle');
    setResult(null);
    setErrorMsg(null);
    setNpi('');
    setNpiError(null);
    setCopied(false);
    autoTriggered.current = false;
  }

  // Not signed in — show sign-in prompt
  if (CLERK_PROVIDER_ENABLED && isLoaded && !isSignedIn) {
    return (
      <TrustStateCard
        eyebrow="Employer review"
        title="Sign in to request a review"
        description="Employer review requests require an employer workspace. Sign in to create a review context and generate a shareable link."
        tone="warning"
        centered
        actions={(
          <Button asChild variant="success" className="h-11 rounded-full px-6">
            <Link href={CLERK_SIGN_IN_URL}>Sign in with employer workspace</Link>
          </Button>
        )}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
          Employer review
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
          Request a passport review
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/50">
          Enter the clinician&apos;s NPI to create a review context. You&apos;ll get a link to send
          them — they open their passport, you open the review surface with full proof and actions.
        </p>
      </div>

      {phase === 'idle' || phase === 'error' ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <label htmlFor="employer-npi" className="sr-only">Clinician NPI</label>
          <Input
            id="employer-npi"
            type="text"
            inputMode="numeric"
            maxLength={10}
            value={npi}
            onChange={e => {
              setNpi(e.target.value.replace(/\D/g, ''));
              if (npiError) setNpiError(null);
            }}
            placeholder="Clinician NPI (10 digits)"
            className="h-14 w-full rounded-xl border-white/12 bg-white/6 px-4 text-[16px] text-white placeholder:text-white/30 shadow-none focus-visible:border-white/30 focus-visible:bg-white/8 focus-visible:ring-white/10"
          />
          {npiError && (
            <p className="text-xs text-red-400/70">{npiError}</p>
          )}
          {errorMsg && (
            <Card className="rounded-xl border-rose-500/20 bg-rose-500/8 px-4 py-3 shadow-none">
              <p className="text-sm text-rose-300/80 leading-relaxed whitespace-pre-line">{errorMsg}</p>
            </Card>
          )}
          <Button
            type="submit"
            variant="success"
            disabled={npi.length !== 10}
            className="h-14 w-full rounded-xl text-sm font-medium"
          >
            Create review context
          </Button>
        </form>
      ) : phase === 'loading' ? (
        <Card className="rounded-xl border-white/8 bg-white/3 px-5 py-6 shadow-none text-center">
          <p className="text-white/50 text-sm">Creating review context…</p>
          <p className="mt-1 text-white/25 text-xs">Resolving NPI and registering context with the audit trail.</p>
        </Card>
      ) : result ? (
        <div className="space-y-4 animate-fade-in-up">
          {/* Context created confirmation */}
          <Card className="rounded-xl border-emerald-500/20 bg-emerald-500/8 px-5 py-4 shadow-none">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 text-sm">✔</span>
              <p className="text-white/80 text-sm font-medium">Review context created</p>
            </div>
            {result.displayName && (
              <p className="mt-1 text-white/50 text-xs">
                For: <span className="text-white/65">{result.displayName}</span> · NPI {result.npi}
              </p>
            )}
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
              <span className="text-white/25">Context ID</span>
              <span className="text-white/50 font-mono break-all">{result.contextId.slice(0, 8)}…</span>
              <span className="text-white/25">Status</span>
              <span className="text-white/50">{result.status}</span>
            </div>
          </Card>

          {/* Review link */}
          <Card className="rounded-xl border-white/8 bg-white/3 px-5 py-4 shadow-none space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
              Review link
            </p>
            <p className="text-xs leading-relaxed text-white/40">
              Send this to the clinician, or open it yourself to see their passport in employer review mode.
            </p>
            <div className="rounded-lg border border-white/8 bg-black/15 px-3 py-2">
              <p className="text-[11px] font-mono text-white/55 break-all">{result.reviewUrl}</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCopy}
                variant="success"
                className="h-11 flex-1 rounded-xl text-sm font-medium"
              >
                {copied ? 'Copied ✔' : 'Copy review link'}
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-xl border-white/10 bg-white/4 text-white/60 hover:border-white/20 hover:bg-white/7 hover:text-white">
                <Link href={result.reviewUrl} target="_blank" rel="noopener noreferrer">
                  Open review
                </Link>
              </Button>
            </div>
          </Card>

          {/* Attribution note */}
          <p className="text-center text-white/20 text-xs leading-relaxed">
            Employer actions on this review will be recorded against context{' '}
            <span className="font-mono">{result.contextId.slice(0, 8)}…</span> in the audit trail.
          </p>

          <Button
            onClick={handleReset}
            variant="ghost"
            className="w-full text-xs text-white/25 hover:text-white/40 hover:bg-transparent"
          >
            Request another review
          </Button>
        </div>
      ) : null}
    </div>
  );
}
