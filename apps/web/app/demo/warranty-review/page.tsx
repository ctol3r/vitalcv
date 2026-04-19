/**
 * Demo — Trust Warranty Review Surface
 *
 * Renders the EmployerReviewDashboard in its single-packet mode with the
 * Trust Warranty capabilities wired:
 *   - Readiness banner + VITALCV WARRANTED shield
 *   - Velocity & Actuarial Risk panel
 *   - Warranty & Indemnity Coverage matrix (collapsible ledger)
 *   - Action Rail with [ Accept & Transfer Risk ]
 *
 * This is a demo surface — seeded data only. Production review flow remains
 * at /review/[entityId].
 */
import EmployerReviewDashboard from '@/components/sandbox/EmployerReviewDashboard';

export const metadata = {
  title: 'Trust Warranty Review · Demo',
};

export default function WarrantyReviewDemoPage() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <div className="border-b border-line bg-ink/[0.04] px-4 py-2 text-center text-[10.5px] font-mono uppercase tracking-[0.14em] text-ink/55">
        Trust Warranty Demo · Seeded packet · Production review lives at{' '}
        <code className="text-ink">/review/[entityId]</code>
      </div>
      <main className="px-4 py-10 sm:py-14">
        <EmployerReviewDashboard
          clinicianName="Dr. Macie Miller, PA-C"
          npi="1003000126"
          timeToStart="14 Days"
          synthesis={{
            verifiedCredentials:
              'NPPES identity confirmed. OIG/LEIE clear. PECOS enrollment active. CA State Board license in good standing.',
            identifiedGaps:
              'DEA registration requires institutional access to verify. Local facility orientation remains the employer\u2019s responsibility.',
            timeline:
              'Estimated onboarding completion in 14 days. Continuous monitoring on 24h interval under warranty.',
          }}
          sources={[
            { name: 'Identity', status: 'CHECKED', details: 'NPPES Registry match confirmed.' },
            { name: 'Sanctions', status: 'CHECKED', details: 'OIG/LEIE exclusion list: no matches.' },
            { name: 'Federal Exclusions', status: 'CHECKED', details: 'SAM.gov clear. No active exclusions.' },
            { name: 'State Board', status: 'CHECKED', details: 'CA PA license active and in good standing.' },
            { name: 'Medicare Enrollment', status: 'CHECKED', details: 'PECOS enrollment confirmed.' },
            { name: 'Board Certification', status: 'CHECKED', details: 'NCCPA certification verified.' },
            { name: 'DEA Registration', status: 'ACCESS REQUIRED', details: 'Institutional access required to verify DEA registration.' },
            { name: 'NPDB', status: 'PENDING', details: 'NPDB query submitted — typical return < 1 min.' },
          ]}
        />
      </main>
    </div>
  );
}
