import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'VitalCV privacy practices for healthcare credentialing data.',
  openGraph: {
    title: 'Privacy Policy',
    description:
      'VitalCV privacy practices for healthcare credentialing data.',
    url: 'https://vitalcv.com/privacy',
  },
};

const SECTIONS = [
  {
    title: 'Data We Process',
    content:
      'VitalCV processes publicly available credentialing data including National Provider Identifier (NPI) numbers, OIG/LEIE exclusion status, CMS PECOS enrollment records, and state licensure information. We do not collect, store, or transmit Protected Health Information (PHI).',
  },
  {
    title: 'How We Use Your Data',
    content:
      'We use provider data solely to generate source-backed readiness snapshots and credential passports. Employer review actions are audit-logged and attributed to the acting organization. We do not sell, share, or monetize individual provider data.',
  },
  {
    title: 'Data Storage & Security',
    content:
      'All data is stored in HIPAA-aligned infrastructure with encryption at rest and in transit. Readiness snapshots are scoped to the requesting session. Credential passports are shareable only by the provider or an authorized employer reviewer.',
  },
  {
    title: 'Third-Party Services',
    content:
      'VitalCV integrates with federal data sources (CMS/NPPES, OIG/LEIE, CMS PECOS) and configured state board registries. Authentication is provided by Clerk. Analytics use PostHog with no PII collection. We do not use third-party advertising trackers.',
  },
  {
    title: 'Your Rights',
    content:
      'You may request deletion of any stored readiness data by contacting privacy@vitalcv.com. Providers can view what data is attached to their NPI at any time through the passport surface. Employers may request audit logs of review actions taken by their organization.',
  },
  {
    title: 'Contact',
    content:
      'For privacy questions, data requests, or to report a concern, contact privacy@vitalcv.com.',
  },
] as const;

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-14 px-6 pt-12 pb-20">
      <header className="space-y-4">
        <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-3)]">
          Privacy Policy
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--vt-text-1)]">
          How VitalCV handles your data
        </h1>
        <p className="text-[var(--vt-text-2)] leading-relaxed">
          VitalCV is designed for healthcare credentialing workflows. We process only publicly
          available provider data and never store Protected Health Information.
        </p>
        <p className="text-xs text-[var(--vt-text-3)]">
          Last updated: April 2026
        </p>
      </header>

      <hr className="border-[var(--vt-border)]" />

      <div className="space-y-10">
        {SECTIONS.map(({ title, content }) => (
          <section key={title} className="space-y-3">
            <h2 className="text-sm font-semibold text-[var(--vt-text-1)]">
              {title}
            </h2>
            <p className="text-sm leading-6 text-[var(--vt-text-2)]">
              {content}
            </p>
          </section>
        ))}
      </div>
    </article>
  );
}
