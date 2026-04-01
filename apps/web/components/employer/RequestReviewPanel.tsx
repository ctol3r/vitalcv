'use client';

/**
 * RequestReviewPanel — Employer-initiated review context creation.
 *
 * States:
 *   idle           → NPI form
 *   loading        → creating context
 *   needs_setup    → employer workspace not found; shows EmployerWorkspaceSetup inline
 *   done           → context created, review link ready
 *   error          → generic error with retry
 *
 * Auth:
 *   not_signed_in  → sign-in prompt (Clerk enabled) or direct form (no Clerk)
 */

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { TrustStateCard } from '@/components/trust/TrustStateCard';
import { EmployerWorkspaceSetup } from './EmployerWorkspaceSetup';
import { useRoleContext } from '@/components/auth/RoleContext';
import {
  CLERK_PROVIDER_ENABLED,
  CLERK_SIGN_IN_URL,
} from '@/lib/auth/clerkConfig';
import {
  isRequestReviewErrorPayload,
  type RequestReviewErrorPayload,
} from '@/lib/request-review-contract';
import { trackPilotEvent } from '@/lib/pilot-ops/client';
import { UX_EVENTS } from '@/lib/analytics/ux-events';

interface ReviewRequestResult {
  contextId: string;
  entityId: string;
  reviewUrl: string;
  npi: string;
  displayName: string | null;
  status: string;
}

type Phase = 'idle' | 'loading' | 'needs_setup' | 'done' | 'error';

export function RequestReviewPanel() {
  const [npi, setNpi] = useState('');
  const [npiError, setNpiError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<ReviewRequestResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [setupHint, setSetupHint] = useState<string | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const lastNpiRef = useRef<string>('');

  const { isLoaded, isSignedIn } = useRoleContext();

  useEffect(() => {
    void trackPilotEvent({
      eventType: UX_EVENTS.REVIEW_REQUESTED,
      route: '/review/request',
      oncePerSession: true,
      message: 'Review request page viewed',
    });
  }, []);

  async function submitRequest(npiValue: string) {
    setNpiError(null);
    setPhase('loading');
    setResult(null);
    setErrorMsg(null);
    setCopied(false);
    lastNpiRef.current = npiValue;

    try {
      const res = await fetch('/api/request-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npi: npiValue }),
      });

      const data = await res.json() as ReviewRequestResult & {
        code?: string;
        error?: string;
        hint?: string;
        nextStep?: RequestReviewErrorPayload['nextStep'];
      };

      if (!res.ok) {
        if (
          isRequestReviewErrorPayload(data)
          && (
            data.nextStep === 'create_workspace'
            || data.nextStep === 'complete_workspace_identity'
          )
        ) {
          setSetupHint(data.hint);
          setPhase('needs_setup');
          return;
        }

        // Preserve the backend entity-registration recovery path until that
        // route emits the same structured contract.
        if (
          (res.status === 404 || res.status === 422)
          && data.hint?.includes('VcvEntity')
        ) {
          setSetupHint(data.hint);
          setPhase('needs_setup');
          return;
        }

        setErrorMsg(data.error ?? 'Could not create review context.');
        setPhase('error');
        return;
      }

      setResult(data);
      setPhase('done');
      void trackPilotEvent({
        eventType: UX_EVENTS.REVIEW_REQUESTED,
        route: '/review/request',
        oncePerSession: false,
        message: 'Review context submitted',
      });
    } catch {
      setErrorMsg('Request failed. Check your connection and try again.');
      setPhase('error');
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = npi.trim();
    if (!/^\d{10}$/.test(trimmed)) {
      setNpiError('Enter a valid 10-digit NPI.');
      return;
    }
    void submitRequest(trimmed);
  }

  async function handleCopy() {
    if (!result?.reviewUrl) return;
    try {
      await navigator.clipboard.writeText(result.reviewUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch { /* silent — URL visible in DOM */ }
  }

  function handleReset() {
    setPhase('idle');
    setResult(null);
    setErrorMsg(null);
    setNpi('');
    setNpiError(null);
    setCopied(false);
    setSetupHint(undefined);
  }

  // Not signed in
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

      {/* NPI form — idle or error */}
      {(phase === 'idle' || phase === 'error') && (
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
          {npiError && <p className="text-xs text-red-400/70">{npiError}</p>}
          {phase === 'error' && errorMsg && (
            <Card className="rounded-xl border-rose-500/20 bg-rose-500/8 px-4 py-3 shadow-none">
              <p className="text-sm text-rose-300/80 leading-relaxed">{errorMsg}</p>
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
      )}

      {/* Loading */}
      {phase === 'loading' && (
        <Card className="rounded-xl border-white/8 bg-white/3 px-5 py-6 shadow-none text-center">
          <p className="text-white/50 text-sm">Creating review context…</p>
          <p className="mt-1 text-white/25 text-xs">Resolving NPI and registering context.</p>
        </Card>
      )}

      {/* Needs workspace setup */}
      {phase === 'needs_setup' && (
        <EmployerWorkspaceSetup
          hint={setupHint}
          onSetupComplete={() => {
            // Auto-retry context creation after workspace is set up
            const npiToRetry = lastNpiRef.current;
            if (npiToRetry) {
              void submitRequest(npiToRetry);
            } else {
              setPhase('idle');
            }
          }}
        />
      )}

      {/* Success */}
      {phase === 'done' && result && (
        <div className="space-y-4 animate-fade-in-up">
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

          <Card className="rounded-xl border-white/8 bg-white/3 px-5 py-4 shadow-none space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
              Review link
            </p>
            <p className="text-xs leading-relaxed text-white/40">
              Send this to the clinician, or open it yourself to see their passport in employer
              review mode. Employer actions on this review will be recorded in the audit trail.
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

          <p className="text-center text-white/20 text-xs leading-relaxed">
            Employer actions on this review are recorded against context{' '}
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
      )}
    </div>
  );
}
