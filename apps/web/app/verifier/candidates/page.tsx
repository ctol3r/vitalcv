import type { Metadata } from 'next';
import Breadcrumb from '@/components/ui/Breadcrumb';
import EmptyState from '@/components/ui/EmptyState';
import { Users } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Candidate Queue — VitalCV',
  description: 'Browse prequalified clinician candidates.',
};

export default function VerifierCandidatesPage() {
  return (
    <div className="min-h-screen bg-ops-gradient text-white surface-operator">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Breadcrumb
          items={[{ label: 'Employer Dashboard', href: '/verifier/home' }, { label: 'Candidates' }]}
          className="mb-6"
        />
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="heading-lg text-white">Verified Candidates</h1>
            <p className="body mt-1 text-vt-neutral-200">Prequalified clinicians ready for review.</p>
          </div>
          <div className="flex gap-2">
            <button className="rounded-full vt-glass px-4 py-2 text-sm font-medium text-vt-neutral-200 hover:text-white transition">
              Filter by specialty
            </button>
            <button className="rounded-full vt-glass px-4 py-2 text-sm font-medium text-vt-neutral-200 hover:text-white transition">
              Filter by L-level
            </button>
          </div>
        </header>
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="No candidates yet"
          description="Post an opportunity to start receiving prequalified applicants. VitalCV will surface clinicians whose trust state matches your requirements."
          cta={{ label: 'Post an Opportunity', href: '/verifier/opportunities' }}
        />
      </main>
    </div>
  );
}
