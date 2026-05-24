import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Attribution — VitalCV',
  description:
    'Data sources, third-party services, and attributions for VitalCV credential readiness infrastructure.',
};

const DATA_SOURCES = [
  {
    name: 'NPPES (National Plan & Provider Enumeration System)',
    provider: 'Centers for Medicare & Medicaid Services (CMS)',
    url: 'https://npiregistry.cms.hhs.gov/',
    use: 'Provider identity and NPI validation',
    notes: 'Public federal registry. Data accuracy is source-of-truth at CMS.',
  },
  {
    name: 'OIG LEIE (List of Excluded Individuals/Entities)',
    provider: 'U.S. Department of Health & Human Services, Office of Inspector General',
    url: 'https://oig.hhs.gov/exclusions/',
    use: 'Federal exclusion screening',
    notes: 'Public federal exclusion list. Updated monthly by OIG.',
  },
  {
    name: 'SAM.gov Exclusions',
    provider: 'U.S. General Services Administration',
    url: 'https://sam.gov/',
    use: 'Federal contractor and program participant exclusion screening',
    notes: 'Public federal registry.',
  },
];

const THIRD_PARTY_SERVICES = [
  {
    name: 'Clerk',
    url: 'https://clerk.com/',
    use: 'Authentication and identity management',
  },
  {
    name: 'Railway',
    url: 'https://railway.app/',
    use: 'Infrastructure and deployment',
  },
  {
    name: 'Vercel',
    url: 'https://vercel.com/',
    use: 'Prior deployment platform (migrated)',
  },
];

export default function AttributionPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <nav className="mb-8 text-sm text-muted-foreground">
        <Link href="/trust" className="hover:text-foreground transition-colors">
          ← Trust Register
        </Link>
      </nav>

      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-foreground">
        Attribution
      </h1>
      <p className="mb-10 text-sm text-muted-foreground leading-relaxed">
        VitalCV surfaces data from public federal registries and third-party services.
        This page documents data sources, their provenance, and limitations.
        VitalCV does not represent itself as the authoritative source for any credentialing decision.
      </p>

      <section className="mb-10">
        <h2 className="mb-4 text-base font-semibold text-foreground">Data Sources</h2>
        <div className="space-y-6">
          {DATA_SOURCES.map((s) => (
            <div key={s.name} className="rounded-lg border border-border bg-card p-4">
              <div className="mb-1 flex items-start justify-between gap-4">
                <span className="text-sm font-medium text-foreground">{s.name}</span>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors"
                >
                  Source ↗
                </a>
              </div>
              <p className="text-xs text-muted-foreground mb-1">{s.provider}</p>
              <p className="text-xs text-foreground/80 mb-1">
                <span className="font-medium">Use:</span> {s.use}
              </p>
              <p className="text-xs text-muted-foreground">{s.notes}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-base font-semibold text-foreground">Third-Party Services</h2>
        <div className="space-y-3">
          {THIRD_PARTY_SERVICES.map((s) => (
            <div key={s.name} className="flex items-center justify-between rounded border border-border bg-card px-4 py-3">
              <div>
                <span className="text-sm font-medium text-foreground">{s.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{s.use}</span>
              </div>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors"
              >
                {s.url.replace('https://', '')} ↗
              </a>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">Limitations</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <span className="shrink-0 text-foreground/40">—</span>
            VitalCV surfaces data for informational review only. It does not substitute for primary source verification (PSV) required by credentialing bodies.
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 text-foreground/40">—</span>
            Federal registry data reflects the last published update from the source agency. VitalCV does not guarantee real-time accuracy.
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 text-foreground/40">—</span>
            Absence of an exclusion record does not constitute a clearance. Authoritative exclusion determination requires direct verification with the issuing agency.
          </li>
        </ul>
      </section>

      <div className="mt-12 border-t border-border pt-6">
        <Link href="/trust" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to Trust Register
        </Link>
      </div>
    </main>
  );
}
