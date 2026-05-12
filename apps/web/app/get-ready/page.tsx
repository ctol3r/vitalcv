import type { Metadata } from 'next';
import { GetReadyClient } from './GetReadyClient';

export const metadata: Metadata = {
  title: 'Get Ready · VitalCV',
  description: 'Bind your NPI to start building your source-backed credential record.',
};

export default function GetReadyPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Clinician setup
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight">
          Bind your NPI
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Your 10-digit NPI is the starting point for your source-backed credential record. We resolve
          it from NPPES and link it to your account.
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
