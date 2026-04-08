/**
 * Sign-Up Page — Wave 136: Clerk Production Activation
 *
 * Uses Clerk <SignUp> component. Redirect URLs are driven by
 * NEXT_PUBLIC_CLERK_SIGN_UP_URL and configured in the Clerk dashboard.
 * No hardcoded dev-instance assumptions.
 */
import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { SignUp } from '@clerk/nextjs';

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create your VitalCV account and build the reusable clinician record you can carry from upload to readiness, passport, and applications.',
};

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(26rem,30rem)]">
        <section className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300/80">
            Clinician setup
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Build one clinician record you can keep using.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-zinc-300">
            VitalCV is the clinician record that follows you from sign up to upload, readiness, passport,
            sharing, and applications. Start once, see what is already on file, see what still needs
            source-backed checks, and keep moving without rebuilding the same story for every employer.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm font-semibold text-white">Upload once</p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Start with your CV or evidence instead of blank forms, then let VitalCV carry those details forward.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm font-semibold text-white">See what changed</p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                See what VitalCV stored, what has been source-checked, and what still needs action before you share or apply.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm font-semibold text-white">Move into passport and apply</p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Use the same readiness and passport context when you explore roles, share with an employer, and start an application.
              </p>
            </div>
          </div>

          <p className="mt-6 text-sm text-zinc-500">
            Already have an account?{' '}
            <Link href="/sign-in" className="font-medium text-emerald-300 transition hover:text-emerald-200">
              Sign in and continue
            </Link>
          </p>
        </section>

        <div className="flex justify-center lg:justify-end">
          <SignUp
            appearance={{
              elements: {
                rootBox: 'rounded-2xl shadow-2xl',
                card: 'bg-zinc-900 border border-zinc-800',
                headerTitle: 'text-white',
                headerSubtitle: 'text-zinc-400',
                formButtonPrimary: 'bg-emerald-500 hover:bg-emerald-600 text-white',
                formFieldInput:
                  'bg-zinc-800 border-zinc-700 text-foreground placeholder:text-zinc-500',
                footerActionLink: 'text-emerald-400 hover:text-emerald-300',
                identityPreviewEditButton: 'text-emerald-400',
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
