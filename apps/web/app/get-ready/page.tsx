import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, Upload, ClipboardCheck, Zap, ChevronRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Get Ready — VitalCV',
  description: 'Complete your credentialing profile and unlock instant job offers.',
};

const STEPS = [
  {
    number: '01',
    icon: ShieldCheck,
    title: 'Verify Your NPI',
    description: 'Enter your 10-digit NPI. VitalCV pulls your public registry data instantly and confirms your Type 1 individual identity.',
    status: 'pending' as const,
    est: '2 min',
  },
  {
    number: '02',
    icon: Upload,
    title: 'Upload Credentials',
    description: 'Upload your state licenses, board certifications, DEA registration, and malpractice documents. We verify in the background.',
    status: 'pending' as const,
    est: '5 min',
  },
  {
    number: '03',
    icon: ClipboardCheck,
    title: 'Complete Your Assessment',
    description: 'A short specialty-aware assessment that helps employers understand your clinical background and work preferences.',
    status: 'pending' as const,
    est: '10 min',
  },
  {
    number: '04',
    icon: Zap,
    title: 'Start Earning',
    description: 'Your trust profile is live. Employers can find you, send instant offers, and you can start as soon as you\'re cleared.',
    status: 'locked' as const,
    est: 'Ongoing',
  },
];

const STATUS_CONFIG = {
  pending: { className: 'border-vt-neutral-800 bg-vt-surface-ops-raised/40', badge: 'text-vt-neutral-800', label: 'Pending' },
  complete: { className: 'border-vt-success/30 bg-vt-success/5', badge: 'text-vt-success', label: 'Complete' },
  locked:   { className: 'border-vt-neutral-800/50 bg-vt-surface-ops-base/40 opacity-60', badge: 'text-vt-neutral-800', label: 'Locked' },
};

export default function GetReadyPage() {
  return (
    <div className="min-h-screen bg-ops-gradient text-white surface-operator">

      {/* Hero */}
      <section className="border-b border-vt-neutral-800 px-6 py-16 text-center">
        <h1 className="heading-xl text-white">
          Get Ready.<br />
          <span className="text-vt-success">Get Hired Faster.</span>
        </h1>
        <p className="body-lg mx-auto mt-4 max-w-xl text-vt-neutral-200">
          Complete your trust profile once. Employers verify you automatically.
          No redundant paperwork, no credential re-submission.
        </p>
      </section>

      {/* Steps */}
      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="space-y-4">
          {STEPS.map((step, i) => {
            const config = STATUS_CONFIG[step.status];
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className={`rounded-2xl border p-6 transition-colors ${config.className}`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-vt-surface-ops-base ring-1 ring-vt-neutral-800">
                    <Icon className="h-4.5 w-4.5 text-vt-neutral-200" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="heading-sm text-white">{step.title}</h2>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`tag ${config.badge}`}>{step.est}</span>
                        <span className={`tag ${config.badge}`}>{config.label}</span>
                      </div>
                    </div>
                    <p className="body-sm mt-1.5 text-vt-neutral-200">{step.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-10 text-center">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-full bg-vt-success px-8 py-3.5 text-base font-semibold text-black hover:bg-vt-success/90 transition"
          >
            Start Now — Free <ChevronRight className="h-4 w-4" />
          </Link>
          <p className="body-sm mt-3 text-vt-neutral-800">
            No credit card. No obligation. Your data stays yours.
          </p>
        </div>
      </main>
    </div>
  );
}
