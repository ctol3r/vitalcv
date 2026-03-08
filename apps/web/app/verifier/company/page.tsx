import type { Metadata } from 'next';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { Building2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Organization Profile — VitalCV',
  description: 'Manage your employer profile and credential requirements.',
};

export default function VerifierCompanyPage() {
  return (
    <div className="min-h-screen bg-ops-gradient text-white surface-operator">
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Breadcrumb
          items={[{ label: 'Employer Dashboard', href: '/verifier/home' }, { label: 'Organization Profile' }]}
          className="mb-6"
        />
        <header className="mb-8">
          <h1 className="heading-lg text-white">Organization Profile</h1>
          <p className="body mt-1 text-vt-neutral-200">
            Your employer profile is visible to clinicians before they apply.
          </p>
        </header>

        <div className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-8 text-center">
          <Building2 className="mx-auto mb-4 h-10 w-10 text-vt-neutral-800" />
          <p className="heading-md text-vt-neutral-100">Profile Setup Coming Soon</p>
          <p className="body-sm mx-auto mt-2 max-w-sm text-vt-neutral-200">
            Organization profile configuration will be available in Wave 186.
            This includes facility type, specialties, credential thresholds, and onboarding speed.
          </p>
        </div>
      </main>
    </div>
  );
}
