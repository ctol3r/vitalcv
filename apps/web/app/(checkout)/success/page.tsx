import * as React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Request received — VitalCV',
  description: 'Your pilot intake request has been received. We will follow up within two business days.',
};

export default function CheckoutSuccessPage(): React.ReactElement {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-2xl font-semibold">Request received</h1>
      <p className="max-w-md text-muted-foreground">
        Your pilot intake request has been received. A member of the VitalCV team will
        follow up within two business days to confirm scope and schedule your kickoff.
      </p>
      <p className="text-sm text-muted-foreground">
        Credential verification begins only after your signed scope document is in place
        and your clinician roster is confirmed.
      </p>
      <a
        href="/"
        className="text-sm underline underline-offset-4"
      >
        Return to home
      </a>
    </main>
  );
}
