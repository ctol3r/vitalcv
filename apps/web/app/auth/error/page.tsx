import Link from 'next/link';
import { AlertTriangle, ArrowRight, Home, LogIn } from 'lucide-react';
import { PilotFailureSignal } from '@/components/pilot-ops/PilotFailureSignal';
import { SupportActionButton } from '@/components/pilot-ops/SupportActionButton';

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-16 text-white">
      <PilotFailureSignal
        eventType="auth_failure"
        title="Sign-in issue"
        message="The pilot user could not finish authentication or workspace matching."
        queueItem={null}
        dedupeKey="auth:error-page"
      />
      <div className="mx-auto max-w-2xl">
        <div className="rounded-[28px] border border-zinc-800 bg-zinc-900/80 p-8 shadow-2xl shadow-black/30">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Sign-in issue</p>
              <h1 className="mt-1 text-2xl font-semibold text-white">We couldn&apos;t finish signing you in</h1>
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm leading-6 text-zinc-300">
            <p>
              Your session may have expired, or your VitalCV workspace could not be matched yet.
            </p>
            <p className="text-zinc-400">
              Next step: sign in again. If the same screen returns, go back to the homepage and restart from the live flow you were using.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400"
            >
              <LogIn className="h-4 w-4" />
              Try sign-in again
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:text-white"
            >
              <Home className="h-4 w-4" />
              Return home
            </Link>
            <SupportActionButton
              label="Contact support"
              title="Sign-in issue"
              messagePrefill="Authentication or workspace matching failed."
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:text-white"
            />
          </div>

          <Link
            href="/demo"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-emerald-300 transition hover:text-emerald-200"
          >
            Open the launch demo entry points
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
