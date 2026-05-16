import type { Metadata } from 'next';
import { GetReadyClient } from './GetReadyClient';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Check Your Readiness · VitalCV',
  description: 'Enter your NPI and see your credential readiness in 30 seconds. No documents needed to start.',
};

export default function GetReadyPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Get credential-ready
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight">
          Enter your NPI
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Your 10-digit NPI is your starting point. We check federal registries instantly and show
          you exactly what is ready, what is missing, and what to do next.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <GetReadyClient />
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Already have an account?{' '}
        <a href="/holder" className="underline underline-offset-2 hover:text-foreground">
          Go to your wallet
        </a>
      </p>
    </main>
  );
}
