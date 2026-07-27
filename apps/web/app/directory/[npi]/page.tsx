/**
 * /directory/[npi] — the public, indexable provider page.
 *
 * Distinct from /verify/[npi] on purpose. The verifier view answers "what has
 * been checked about this clinician, and how fresh is it" for someone making a
 * hiring decision. This page answers "who is this NPI" for someone who arrived
 * from a search engine, and is the surface built to be indexed.
 *
 * Same record, same component, same honesty rules — the difference is framing
 * and cacheability, not content. Building it on a second data path is how the
 * two would end up disagreeing about the same person.
 *
 * WHY THIS IS SAFE TO INDEX
 * -------------------------
 * NPPES is a public federal registry; every field here is already published by
 * CMS. What indexing changes is the audience, so the page has to be even more
 * careful than the verifier view about not reading as a credential check —
 * a search result is seen with no surrounding context at all. The record
 * component carries that burden; this page adds a plain-language banner up
 * top rather than relying on the reader scrolling.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ClinicianRecordDetail } from '@/components/clinician-record/ClinicianRecordDetail';
import { fetchNppesRecord } from '@/lib/clinician-record/nppes';
import { buildClinicianRecord, attachMedicareEnrollment } from '@/lib/clinician-record/build';
import { fetchCmsClinicianRows } from '@/lib/clinician-record/cmsClinicians';
import { DIRECTORY_CONTEXT_NOTE } from '@/lib/clinician-record/copy';

/**
 * Cache for the NPPES refresh window. CMS updates weekly, so re-fetching per
 * request buys nothing and makes an indexable page depend on CMS being up at
 * crawl time.
 */
export const revalidate = 3600;

interface PageProps {
  params: Promise<{ npi: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { npi } = await params;
  const nppes = await fetchNppesRecord(npi);

  if (!nppes) {
    return {
      title: `NPI ${npi} · VitalCV`,
      robots: { index: false, follow: false },
    };
  }

  const record = buildClinicianRecord(nppes.reading, {
    retrievedAt: nppes.retrievedAt,
  });
  const primary = record.taxonomies.data[0];
  const city = record.practiceAddress.data?.city ?? '';
  const state = record.practiceAddress.data?.state ?? '';
  const where = [city, state].filter(Boolean).join(', ');

  const name = record.identity.data.displayName || `NPI ${npi}`;
  const what = primary?.displayName ?? '';

  return {
    title: `${name}${what ? ` — ${what}` : ''}${where ? `, ${where}` : ''} · NPI ${npi}`,
    // Describes the page honestly: this is a registry filing, not a check.
    description: `Public CMS registry record for ${name}${
      what ? `, ${what}` : ''
    }${where ? ` in ${where}` : ''}. NPI ${npi}. Shows what was filed with CMS, including what is not covered by the filing.`,
    alternates: { canonical: `/directory/${npi}` },
  };
}

export default async function ProviderDirectoryPage({ params }: PageProps) {
  const { npi } = await params;

  if (!/^\d{10}$/.test(npi)) notFound();

  const nppes = await fetchNppesRecord(npi);
  if (!nppes) notFound();

  // The Medicare lookup runs alongside nothing else here, but is deliberately
  // attached AFTER the base record exists: a slow or failed second federal
  // source must never be able to take the primary record off the page.
  const cms = await fetchCmsClinicianRows(npi);

  const record = attachMedicareEnrollment(
    buildClinicianRecord(nppes.reading, { retrievedAt: nppes.retrievedAt }),
    cms,
    nppes.reading,
  );

  const primary = record.taxonomies.data[0];
  const address = record.practiceAddress.data;

  /**
   * schema.org markup so a search engine renders this as a provider listing.
   *
   * Deliberately omits every property that would assert a qualification.
   * The credential string is self-reported to CMS, so emitting it as
   * structured credential data would let a search engine present an
   * unverified claim as a verified attribute of the person.
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': record.entityType === 'organization' ? 'MedicalOrganization' : 'Physician',
    name: record.identity.data.displayName,
    identifier: {
      '@type': 'PropertyValue',
      propertyID: 'NPI',
      value: record.npi,
    },
    ...(primary?.displayName ? { medicalSpecialty: primary.displayName } : {}),
    ...(address
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: [address.line1, address.line2].filter(Boolean).join(' '),
            addressLocality: address.city,
            addressRegion: address.state,
            postalCode: address.postalCodeFormatted || address.postalCode,
            addressCountry: address.countryCode,
          },
          ...(address.telephone ? { telephone: address.telephone } : {}),
        }
      : {}),
  };

  return (
    <div className="mz mz-paper min-h-screen">
      <script
        type="application/ld+json"
        // Server-rendered from values we constructed; no user input reaches it.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:py-12">
        <header className="space-y-2">
          <p className="mz-eyebrow">Public registry record</p>
          <h1 className="mz-h1">
            {record.identity.data.displayName || `NPI ${record.npi}`}
          </h1>
          <p className="text-sm text-[var(--ink-600)]">
            {[
              record.entityTypeLabel,
              primary?.displayName,
              address ? [address.city, address.state].filter(Boolean).join(', ') : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </header>

        {/* A search result arrives with no surrounding context, so what this
            page is — and is not — has to be stated before the data, not after. */}
        <div
          className="rounded-[3px] border px-4 py-3"
          style={{
            background: 'var(--unknown-bg)',
            borderColor: 'var(--unknown-rule)',
          }}
        >
          <p className="text-[13px] leading-relaxed text-[var(--ink-700)]">
            {DIRECTORY_CONTEXT_NOTE}
          </p>
        </div>

        <ClinicianRecordDetail record={record} mode="public" />

        <footer className="border-t border-[var(--rule)] pt-4">
          <p className="text-[12px] leading-relaxed text-[var(--ink-600)]">
            Employers reviewing this clinician can see source coverage and
            verification history on the{' '}
            <Link href={`/verify/${record.npi}`} className="underline">
              verification view
            </Link>
            .
          </p>
        </footer>
      </main>
    </div>
  );
}
