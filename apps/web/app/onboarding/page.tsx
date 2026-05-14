import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Fingerprint } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Activation Continuation | VitalCV',
  description:
    'Continue the path already started in passport. Onboarding refines activation without restarting the work.',
};

const CONTINUATION_POINTS = [
  {
    title: 'Identity stays anchored',
    body: 'Your NPI remains the anchor. Nothing here asks you to re-enter what VitalCV already recognized.',
  },
  {
    title: 'Momentum stays visible',
    body: 'The path reads as continuation, not setup bureaucracy.',
  },
  {
    title: 'Progress stays calm',
    body: 'One screen, one primary action, and a clear handoff into the next step.',
  },
] as const;

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  const returnHref = typeof returnTo === 'string' && returnTo.startsWith('/') ? returnTo : '/passport';
  const continueHref =
    typeof returnTo === 'string' && returnTo.startsWith('/')
      ? `/clinician/onboarding?returnTo=${encodeURIComponent(returnTo)}`
      : '/clinician/onboarding';

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-16 sm:py-20">
      <div className="w-full max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--vt-border-subtle)] bg-[color-mix(in_oklab,var(--vt-surface)_84%,transparent)] px-3 py-1 text-[11px] font-medium text-[var(--vt-text-muted)]">
          <Fingerprint className="h-3.5 w-3.5" aria-hidden="true" />
          Activation continuation
        </div>

        <div className="mt-8 space-y-6">
          <h1 className="max-w-2xl text-[clamp(2.8rem,7vw,4.6rem)] leading-[0.94] font-semibold tracking-[-0.05em] text-[var(--vt-text-primary)]">
            Keep the momentum going.
          </h1>

          <p className="max-w-xl text-[18px] leading-[1.6] text-[var(--vt-text-secondary)]">
            You are already recognized. Onboarding continues the motion from the
            passport snapshot without asking you to start over.
          </p>
        </div>

        <Card className="mt-10 max-w-2xl border-[var(--vt-border)] bg-[var(--vt-surface)] shadow-none">
          <CardHeader className="border-b border-[var(--vt-border-subtle)] px-5 py-5 sm:px-6">
            <CardTitle className="text-base font-semibold text-[var(--vt-text-primary)]">
              Continue without resetting
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed text-[var(--vt-text-muted)]">
              This is a continuation surface. It keeps the work moving while
              preserving the snapshot already shown in passport.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
            <div className="space-y-4">
              {CONTINUATION_POINTS.map((point) => (
                <div key={point.title} className="space-y-1.5">
                  <p className="text-sm font-medium text-[var(--vt-text-primary)]">
                    {point.title}
                  </p>
                  <p className="text-sm leading-relaxed text-[var(--vt-text-muted)]">
                    {point.body}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="success" className="h-11 rounded-full px-5 text-sm font-medium">
                <Link href={continueHref}>
                  Continue to onboarding
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-full px-5 text-sm font-medium">
                <Link href={returnHref}>Open passport</Link>
              </Button>
            </div>
          </CardContent>

          <CardFooter className="border-t border-[var(--vt-border-subtle)] px-5 py-4 sm:px-6">
            <p className="text-xs leading-relaxed text-[var(--vt-text-muted)]">
              Onboarding summarizes the continuation path. It does not complete credentialing.
            </p>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
