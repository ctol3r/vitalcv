import type { Metadata } from 'next';
import { RequestReviewPanel } from '@/components/employer/RequestReviewPanel';

export const metadata: Metadata = {
  title: 'Request Pilot Review',
  description: 'Request a source-backed pilot review for a clinician.',
};

export default function RequestReviewPage() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center px-4 pt-16 sm:pt-24 pb-24">
      <div className="w-full max-w-sm">
        <RequestReviewPanel />
      </div>
    </main>
  );
}
