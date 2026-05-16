import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PilotIntakeForm } from './PilotIntakeForm';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Contact — Start a Pilot — VitalCV',
  description:
    'Tell us about your credentialing flow. We typically reply within one business day.',
};

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-12" data-testid="contact-page">
      <header className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
          Start a pilot
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">
          Tell us about your credentialing flow.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A short note is enough. We typically reply within one business day. If
          you&rsquo;d rather email, send a note to{' '}
          <a className="underline" href="mailto:hello@vitalcv.com">hello@vitalcv.com</a>.
        </p>
      </header>
      <Suspense fallback={null}>
        <PilotIntakeForm />
      </Suspense>
    </main>
  );
}
