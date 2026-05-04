import * as React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Request not submitted — VitalCV',
  description: 'Your request was not submitted. You can try again or contact us directly.',
};

export default function CheckoutCancelPage(): React.ReactElement {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-2xl font-semibold">Request not submitted</h1>
      <p className="max-w-md text-muted-foreground">
        Your intake request was not submitted. No information has been recorded and no
        commitment has been made.
      </p>
      <div className="flex gap-4">
        <a
          href="/pilot"
          className="text-sm underline underline-offset-4"
        >
          Try again
        </a>
        <a
          href="/"
          className="text-sm underline underline-offset-4"
        >
          Return to home
        </a>
      </div>
    </main>
  );
}
