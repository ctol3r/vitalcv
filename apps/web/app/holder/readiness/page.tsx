import * as React from 'react';
import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';

type WorkspaceResponse = {
  personProfile?: {
    npi?: string | null;
    firstName?: string | null;
  } | null;
};

type TrustStateResponse = {
  npi: string;
  readiness_level: 'L0' | 'L1' | 'L2' | 'L3';
  readiness_score: number;
  readiness_status: string;
  gap_summary: string[];
};

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

function buildForwardHeaders(session: Awaited<ReturnType<typeof auth>>): Headers {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.set('x-clerk-user-id', session.userId ?? '');

  const emailClaim = (session.sessionClaims as Record<string, unknown> | undefined)?.email;
  if (typeof emailClaim === 'string' && emailClaim.length > 0) {
    headers.set('x-clerk-user-email', emailClaim);
  }

  return headers;
}

const LEVEL_STYLES: Record<TrustStateResponse['readiness_level'], string> = {
  L3: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  L2: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  L1: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  L0: 'border-red-500/30 bg-red-500/10 text-red-300',
};

async function fetchWorkspace(session: Awaited<ReturnType<typeof auth>>): Promise<WorkspaceResponse> {
  const res = await fetch(`${BACKEND}/api/me/workspaces`, {
    headers: buildForwardHeaders(session),
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) {
    throw new Error(`workspace_lookup_failed:${res.status}`);
  }

  return res.json() as Promise<WorkspaceResponse>;
}

async function fetchTrustState(npi: string): Promise<TrustStateResponse> {
  const res = await fetch(`${BACKEND}/api/trust-state/${encodeURIComponent(npi)}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) {
    throw new Error(`trust_state_failed:${res.status}`);
  }

  return res.json() as Promise<TrustStateResponse>;
}

export default async function HolderReadinessPage() {
  const session = await auth();

  if (!session.userId) {
    redirect('/sign-in?redirect_url=/holder/readiness');
  }

  let workspace: WorkspaceResponse;
  try {
    workspace = await fetchWorkspace(session);
  } catch {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8 text-white">
        <div className="max-w-sm text-center space-y-4">
          <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto" />
          <p className="text-lg font-semibold">Could not load your profile.</p>
          <p className="text-sm text-zinc-400">Please try again or return to your workspace.</p>
          <Link href="/holder" className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:underline">
            Back to workspace <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  const npi = workspace.personProfile?.npi?.trim();
  if (!npi) {
    redirect('/onboarding');
  }

  let trustState: TrustStateResponse;
  try {
    trustState = await fetchTrustState(npi);
  } catch {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8 text-white">
        <div className="max-w-sm text-center space-y-4">
          <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto" />
          <p className="text-lg font-semibold">Trust state is still computing.</p>
          <p className="text-sm text-zinc-400">Your profile was activated. Verification usually takes under 30 seconds.</p>
          <Link href="/holder/readiness" className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:underline">
            Refresh <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  const greeting = workspace.personProfile?.firstName?.trim();
  const levelStyle = LEVEL_STYLES[trustState.readiness_level];

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="flex flex-col gap-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Clinician Readiness
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {greeting ? `${greeting}, your readiness is live.` : 'Your readiness is live.'}
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              NPI <span className="font-mono text-zinc-200">{trustState.npi}</span> is now bound to your clinician profile.
            </p>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Readiness Status</p>
                <p className="mt-2 text-2xl font-semibold text-white">{trustState.readiness_status}</p>
              </div>
              <div className={`rounded-full border px-4 py-2 text-sm font-semibold ${levelStyle}`}>
                {trustState.readiness_level}
              </div>
            </div>
            <div className="mt-6">
              <div className="flex items-center justify-between text-sm text-zinc-400">
                <span>Readiness score</span>
                <span className="font-semibold text-white">{trustState.readiness_score}/100</span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, trustState.readiness_score))}%` }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Next step</p>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              Review your trust passport and close any outstanding credential gaps from the holder workspace.
            </p>
            <Link
              href="/holder"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
            >
              Open trust passport
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-300" />
            <p className="text-sm font-semibold text-white">Outstanding gaps</p>
          </div>
          {trustState.gap_summary.length > 0 ? (
            <ul className="mt-4 space-y-3 text-sm text-zinc-300">
              {trustState.gap_summary.map((gap) => (
                <li key={gap} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-4 py-3">
                  {gap}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-zinc-400">
              No blocking gaps detected. Your trust-state snapshot is current.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
