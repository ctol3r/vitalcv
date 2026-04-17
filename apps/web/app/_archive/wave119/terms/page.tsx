import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'VitalCV terms of service for clinicians and healthcare employers.',
  openGraph: {
    title: 'Terms of Service',
    description:
      'VitalCV terms of service for clinicians and healthcare employers.',
    url: 'https://vitalcv.com/terms',
  },
};

const SECTIONS = [
  {
    title: 'Service Description',
    content:
      'VitalCV provides source-backed credentialing readiness snapshots and credential passports by querying publicly available federal and state data sources. The service is designed for healthcare clinicians and credentialing professionals.',
  },
  {
    title: 'Readiness Snapshots Are Not Verification',
    content:
      'VitalCV readiness snapshots reflect data retrieved from public sources at a point in time. They are not a substitute for Primary Source Verification (PSV), credentialing committee review, or employer due diligence. Employers using VitalCV for hiring decisions must complete their own credentialing process.',
  },
  {
    title: 'Data Accuracy',
    content:
      'VitalCV retrieves data from CMS/NPPES, OIG/LEIE, CMS PECOS, and configured state board registries. We display data as received from these sources. If a source is unavailable, stale, or returns incomplete data, VitalCV labels it honestly — we do not infer, impute, or upgrade source coverage.',
  },
  {
    title: 'User Responsibilities',
    content:
      'Users are responsible for the accuracy of any NPI they submit. Employer reviewers are responsible for decisions made using VitalCV readiness data. All employer review actions (accept, request refresh, route to review) are audit-logged and attributed.',
  },
  {
    title: 'Acceptable Use',
    content:
      'VitalCV may not be used for bulk data harvesting, automated scraping, or any purpose unrelated to healthcare credentialing. Access may be suspended for misuse, abuse of API rate limits, or submission of fraudulent data.',
  },
  {
    title: 'Limitation of Liability',
    content:
      'VitalCV provides data on an "as-is" basis. We are not liable for hiring decisions, credentialing outcomes, or clinical care decisions made using data from the platform. Our liability is limited to the fees paid for the service.',
  },
  {
    title: 'Changes to Terms',
    content:
      'We may update these terms as VitalCV evolves. Material changes will be communicated through the platform. Continued use after changes constitutes acceptance.',
  },
  {
    title: 'Contact',
    content:
      'For questions about these terms, contact legal@vitalcv.com.',
  },
] as const;

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-14 px-6 pt-12 pb-20">
      <header className="space-y-4">
        <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-3)]">
          Terms of Service
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--vt-text-1)]">
          Terms of use for VitalCV
        </h1>
        <p className="text-[var(--vt-text-2)] leading-relaxed">
          By using VitalCV, you agree to these terms. VitalCV is a credentialing readiness tool,
          not a verification authority.
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
