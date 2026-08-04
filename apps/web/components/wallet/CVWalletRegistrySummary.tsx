import type { ClinicianRecord, RecordAddress } from '@/lib/clinician-record/types';
import { TAXONOMY_LICENSE_PROVENANCE_NOTE } from '@/lib/reference/taxonomy';

function formatAddress(address: RecordAddress | null): string {
  if (!address) return 'Not reported to CMS';
  const cityState = [address.city, address.state].filter(Boolean).join(', ');
  const cityStateZip = [cityState, address.postalCodeFormatted || address.postalCode]
    .filter(Boolean)
    .join(' ');
  return [address.line1, address.line2, cityStateZip].filter(Boolean).join(' · ');
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Date unavailable';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

export function CVWalletRegistrySummary({ record }: { record: ClinicianRecord }) {
  const identity = record.identity.data;
  const primaryTaxonomy =
    record.taxonomies.data.find((taxonomy) => taxonomy.primary) ?? record.taxonomies.data[0] ?? null;

  const licenses = Array.from(
    new Map(
      record.taxonomies.data
        .filter((taxonomy) => taxonomy.license && taxonomy.state)
        .map((taxonomy) => [
          `${taxonomy.state.toUpperCase()}::${taxonomy.license}`,
          {
            state: taxonomy.state.toUpperCase(),
            number: taxonomy.license,
            specialty: taxonomy.displayName,
            taxonomyCode: taxonomy.code,
          },
        ]),
    ).values(),
  );

  return (
    <section
      id="career-record"
      aria-labelledby="career-record-heading"
      className="rounded-[28px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-4 border-b border-[var(--vt-border)] pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-secondary)]">
            What public sources report
          </p>
          <h2 id="career-record-heading" className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            {identity.displayName || `NPI ${record.npi}`}
          </h2>
          <p className="mt-1 text-sm text-[var(--vt-text-secondary)]">
            NPI <span className="font-mono text-foreground">{record.npi}</span>
            {identity.credential.raw ? ` · ${identity.credential.raw}` : ''}
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] px-3 py-1 text-xs font-semibold text-[var(--vt-text-secondary)]">
          NPPES record
        </span>
      </div>

      <div className="grid gap-4 py-5 md:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vt-text-secondary)]">
            Primary specialty
          </p>
          <p className="mt-2 text-base font-semibold text-foreground">
            {primaryTaxonomy?.displayName || 'Not reported to CMS'}
          </p>
          {primaryTaxonomy?.code ? (
            <p className="mt-1 font-mono text-xs text-[var(--vt-text-secondary)]">
              Taxonomy {primaryTaxonomy.code}
            </p>
          ) : null}
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vt-text-secondary)]">
            Practice location
          </p>
          <p className="mt-2 text-sm leading-6 text-foreground">
            {formatAddress(record.practiceAddress.data)}
          </p>
        </div>
      </div>

      <div className="border-t border-[var(--vt-border)] pt-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vt-text-secondary)]">
              State licenses
            </p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">
              Every license number reported in NPPES
            </h3>
          </div>
          <p className="text-xs text-[var(--vt-text-secondary)]">
            Status requires a separate state-board check
          </p>
        </div>

        {licenses.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {licenses.map((license) => (
              <article
                key={`${license.state}-${license.number}`}
                className="rounded-2xl border border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--vt-text-secondary)]">
                      {license.state}
                    </p>
                    <p className="mt-2 break-all font-mono text-base font-semibold text-foreground">
                      {license.number}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-800">
                    Reported to CMS
                  </span>
                </div>
                <p className="mt-3 text-sm text-[var(--vt-text-secondary)]">{license.specialty}</p>
                <p className="mt-1 font-mono text-[11px] text-[var(--vt-text-secondary)]">
                  {license.taxonomyCode}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] p-4">
            <p className="text-sm font-medium text-foreground">No state license number was supplied in this NPPES record.</p>
            <p className="mt-1 text-xs leading-5 text-[var(--vt-text-secondary)]">
              This means the registry did not return one. It does not mean the clinician has no license.
            </p>
          </div>
        )}

        <p className="mt-4 text-xs leading-5 text-[var(--vt-text-secondary)]">
          {TAXONOMY_LICENSE_PROVENANCE_NOTE}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 border-t border-[var(--vt-border)] pt-4 text-xs text-[var(--vt-text-secondary)]">
        <span>CMS record updated {formatDate(record.audit.data.lastUpdated)}</span>
        <span>VitalCV retrieved {formatDate(record.identity.freshness.retrievedAt)}</span>
        <span>{record.taxonomies.data.length} taxonomy row{record.taxonomies.data.length === 1 ? '' : 's'} extracted</span>
      </div>
    </section>
  );
}
