import type { Metadata } from 'next';
import { RequestReviewPanel } from '@/components/employer/RequestReviewPanel';

export const metadata: Metadata = {
  title: 'Request Pilot Review',
  description: 'Request a source-backed pilot review for a clinician.',
};

export default function RequestReviewPage() {
  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center bg-background px-4 py-16 sm:py-24">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/60">
            Employer review
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Request a passport review
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Initiate a source-backed credential review for a clinician. You'll
            create a review context, receive a shareable link, and access the
            employer review surface with full proof and audit-tracked actions.
          </p>
        </div>
        <RequestReviewPanel />
      </div>
    </main>
  );
}
