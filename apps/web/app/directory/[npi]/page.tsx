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
 * component carries that burden; this page states what it is — and is not —
 * before the data, on the record's own chart tab.
 *
 * REGISTER (design-only, 2026-08-16)
 * ----------------------------------
 * The page frame renders in the Direction A register (constitution amendment
 * E; composition discipline from E.1): warm paper, the clinician's name as
 * the display moment, one hot action — the claim CTA — and drawn clinical
 * pictograms that depict no fact. The record itself stays in the shared Calm
 * Wave evidence register (ClinicianRecordDetail inside `.mz`), because
 * evidence keeps its own truthful material; the scene frame around it is what
 * this register pass recomposes. Every data, metadata, analytics, and honesty
 * contract on this page is unchanged.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ClinicianRecordDetail } from '@/components/clinician-record/ClinicianRecordDetail';
import { fetchNppesRecord } from '@/lib/clinician-record/nppes';
import { buildClinicianRecord, attachMedicareEnrollment } from '@/lib/clinician-record/build';
import { fetchCmsClinicianRows } from '@/lib/clinician-record/cmsClinicians';
import { DIRECTORY_CONTEXT_NOTE } from '@/lib/clinician-record/copy';
import { RecordViewTracker, ClaimRecordLink } from '@/components/directory/RecordAnalytics';
import DirectoryReveal from '@/components/directory/DirectoryReveal';
import { isExcludedFromDirectory } from '@/lib/directory/sitemapSeed';
import { DirectoryTiming } from '@/lib/directory/serverTiming';
import '@/styles/directory-record.css';

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
  const timing = new DirectoryTiming('metadata', npi);
  const nppes = await timing.measure('nppes', () => fetchNppesRecord(npi));

  if (!nppes) {
    timing.log();
    return {
      title: `NPI ${npi}`,
      robots: { index: false, follow: false },
      /**
       * The fallback carries its timing too, deliberately: fetchNppesRecord
       * fails closed to null on a timeout, so a metadata-phase NPPES stall to
       * its 8s AbortSignal lands EXACTLY here — a page whose body renders
       * fine while its head quietly went noindex. Production's 8.22–8.30s
       * cold renders are 8.0s (TIMEOUT_MS) + the 0.2–0.3s a healthy phase
       * costs, so this tag is how that hypothesis gets confirmed or killed
       * from a served page: nppes;dur≈8000 here is the smoking gun.
       */
      other: { 'server-timing-metadata': timing.headerValue() },
    };
  }

  // Asked not to be listed. Dropping the NPI from the sitemap only stops us
  // advertising the page — a crawler that already has the URL keeps it — so the
  // same list has to reach the page's own robots directive. Otherwise the
  // product could tell someone they were removed while their page stayed
  // indexed.
  if (isExcludedFromDirectory(npi)) {
    timing.log();
    return {
      title: `NPI ${npi}`,
      robots: { index: false, follow: false },
      other: { 'server-timing-metadata': timing.headerValue() },
    };
  }

  const record = timing.measureSync('assemble', () =>
    buildClinicianRecord(nppes.reading, {
      retrievedAt: nppes.retrievedAt,
    }),
  );
  const primary = record.taxonomies.data[0];
  const city = record.practiceAddress.data?.city ?? '';
  const state = record.practiceAddress.data?.state ?? '';
  const where = [city, state].filter(Boolean).join(', ');

  const name = record.identity.data.displayName || `NPI ${npi}`;
  const what = primary?.displayName ?? '';

  const title = `${name}${what ? ` — ${what}` : ''}${where ? `, ${where}` : ''} · NPI ${npi}`;
  // Describes the page honestly: this is a registry filing, not a check.
  const description = `Public CMS registry record for ${name}${
    what ? `, ${what}` : ''
  }${where ? ` in ${where}` : ''}. NPI ${npi}. Shows what was filed with CMS, including what is not covered by the filing.`;

  timing.log();
  return {
    title,
    description,
    alternates: { canonical: `/directory/${npi}` },
    /**
     * Metadata-phase render timing, Server-Timing field-value syntax. In the
     * document rather than an HTTP header because a server-component page
     * cannot set one, and because this page is ISR — the document carries the
     * timings of the render that actually produced it, which a header on a
     * cache-served response would not. See lib/directory/serverTiming.ts.
     */
    other: { 'server-timing-metadata': timing.headerValue() },
    /**
     * Without these, every provider page inherited the one site-wide card from
     * app/layout.tsx, so a million distinct records shared a single title and
     * blurb everywhere they were shared or previewed. The card now says whose
     * record it is — and says "registry record", because a share preview is
     * read with even less context than a search result.
     *
     * The image stays the site card deliberately: a per-record image would put
     * a named clinician's details into a file fetched by any service that
     * unfurls a link, which is a wider audience than the page itself has.
     */
    openGraph: {
      type: 'profile',
      title,
      description,
      url: `/directory/${npi}`,
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/**
 * The ID-badge pictogram on the claim card. Decorative and aria-hidden, in
 * the E.1 pictogram discipline: values render as blank bars, and it depicts
 * no source, count, person, or result — an empty badge, waiting.
 */
function BadgeGlyph() {
  return (
    <svg className="dra-badge" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect className="dra-badge-frame" x="27" y="4" width="10" height="7" rx="2" />
      <path className="dra-badge-frame" d="M32 11 v4" />
      <rect className="dra-badge-strong" x="12" y="15" width="40" height="44" rx="5" />
      <path className="dra-badge-strong" d="M22 27 h10 M27 22 v10" />
      <rect className="dra-badge-bar" x="20" y="41" width="24" height="4" rx="2" />
      <rect className="dra-badge-bar" x="20" y="49" width="15" height="4" rx="2" />
    </svg>
  );
}

/**
 * The clipboard pictogram on the record's chart tab. Same discipline: blank
 * bars only, no fact depicted.
 */
function ClipboardGlyph() {
  return (
    <svg className="dra-clip" viewBox="0 0 32 40" aria-hidden="true" focusable="false">
      <rect className="dra-clip-frame" x="3" y="6" width="26" height="31" rx="3" />
      <rect className="dra-clip-frame" x="11" y="2" width="10" height="7" rx="2" />
      <rect className="dra-clip-bar" x="8" y="15" width="16" height="3" rx="1.5" />
      <rect className="dra-clip-bar" x="8" y="21" width="12" height="3" rx="1.5" />
      <rect className="dra-clip-bar" x="8" y="27" width="14" height="3" rx="1.5" />
    </svg>
  );
}

export default async function ProviderDirectoryPage({ params }: PageProps) {
  const { npi } = await params;

  if (!/^\d{10}$/.test(npi)) notFound();

  const timing = new DirectoryTiming('page', npi);

  const nppes = await timing.measure('nppes', () => fetchNppesRecord(npi));
  if (!nppes) {
    timing.log();
    notFound();
  }

  // The Medicare lookup runs alongside nothing else here, but is deliberately
  // attached AFTER the base record exists: a slow or failed second federal
  // source must never be able to take the primary record off the page.
  const cms = await timing.measure('cms', () => fetchCmsClinicianRows(npi));

  const record = timing.measureSync('assemble', () =>
    attachMedicareEnrollment(
      buildClinicianRecord(nppes.reading, { retrievedAt: nppes.retrievedAt }),
      cms,
      nppes.reading,
    ),
  );

  const primary = record.taxonomies.data[0];
  const address = record.practiceAddress.data;
  const isIndividual = record.entityType !== 'organization';

  /**
   * schema.org markup so a search engine renders this as a provider listing.
   *
   * Deliberately omits every property that would assert a qualification.
   * The credential string is self-reported to CMS, so emitting it as
   * structured credential data would let a search engine present an
   * unverified claim as a verified attribute of the person.
   */
  const jsonLd = timing.measureSync('jsonld', () => ({
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
  }));

  timing.log();

  return (
    <div className="dra min-h-screen">
      <script
        type="application/ld+json"
        // Server-rendered from values we constructed; no user input reaches it.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Page-phase render timing, Server-Timing field-value syntax. Inert
          (unknown script type; never executed, never rendered). In the document
          rather than an HTTP header because a server-component page cannot set
          one, and because under ISR the document — unlike a header on a
          cache-served response — carries the timings of the render that
          actually produced it. Span names and durations only; nothing
          caller-supplied reaches this string. See lib/directory/serverTiming.ts. */}
      <script
        type="application/server-timing"
        id="directory-server-timing"
        dangerouslySetInnerHTML={{ __html: timing.headerValue() }}
      />

      {/* Fires for organization records too — an employer landing on a practice
          page is signal, and dropping it would make the funnel's denominator
          quietly clinician-only. */}
      <RecordViewTracker
        entityType={record.entityType === 'organization' ? 'organization' : 'individual'}
      />

      {/* One-shot entrance enhancement; the server frame above and below is
          complete without it. */}
      <DirectoryReveal />

      <main className="dra-wrap">
        <header className="dra-head" data-dra-reveal>
          <p className="dra-eyebrow">Public registry record</p>
          <h1 className="dra-name">
            {record.identity.data.displayName || `NPI ${record.npi}`}
          </h1>
          {/* The drawn pulse under the name: decorative ink, draws once. */}
          <svg className="dra-pulse" viewBox="0 0 360 28" aria-hidden="true" focusable="false">
            <path
              className="dra-pulse-path"
              pathLength={1}
              d="M2 18 H92 L100 18 L107 4 L116 26 L122 18 H210 L218 18 L224 9 L231 24 L236 18 H358"
            />
          </svg>
          <p className="dra-meta">
            {[
              record.entityTypeLabel,
              primary?.displayName,
              address ? [address.city, address.state].filter(Boolean).join(', ') : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </header>

        {/* The claim entry, first — the emotional beat of the whole page.
            A clinician who searches for themselves lands here having never
            heard of VitalCV; the record is the introduction, and their name is
            already set at the table above. One obvious next action (EC-2 #3,
            EC-11): the invitation leads, the full record follows for whoever
            wants to read what the registry holds. "Your VitalCV profile" is
            one of the four names the category strategy requires customers to
            remember; this is the first place a clinician ever encounters it.
            Individual records only; an organization NPI has no one to claim it. */}
        {isIndividual ? (
          <section id="claim" className="dra-claim" data-dra-reveal aria-labelledby="dra-claim-h">
            <BadgeGlyph />
            <div className="dra-claim-copy">
              <h2 id="dra-claim-h" className="dra-claim-h">
                Is this you?
              </h2>
              <p>
                Claim it and it becomes your VitalCV profile &mdash; yours to keep, add to, and
                reuse. Claiming confirms nothing about your credentials and changes nothing on
                this page.
              </p>
            </div>
            <div className="dra-claim-act">
              <ClaimRecordLink npi={record.npi} className="dra-cta">
                Claim this record
              </ClaimRecordLink>
              <p className="dra-claim-fine">Free for clinicians.</p>
            </div>
          </section>
        ) : null}

        {/* The record, framed as the chart it is. A search result arrives with
            no surrounding context, so what this page is — and is not — rides
            on the chart tab, before the data, not after it. */}
        <section
          className="dra-record"
          data-dra-reveal
          aria-label="The public record, as filed with CMS"
        >
          <div className="dra-record-tab">
            <ClipboardGlyph />
            <p className="dra-note">{DIRECTORY_CONTEXT_NOTE}</p>
          </div>
          <div className="mz dra-record-body">
            <ClinicianRecordDetail record={record} mode="public" />
          </div>
        </section>

        {/* Why the page exists and the way out, as two flat answers.
            The removal path stays on the record itself: this page can exist
            for a clinician who has never heard of VitalCV, and a person in
            that position needs a way out that does not depend on knowing
            VitalCV well enough to go looking for a policy page. Deliberately
            an email address and not a form: a form would be a new place to
            collect personal data in order to process a request whose entire
            content is "stop". */}
        <section className="dra-qa" data-dra-reveal aria-labelledby="dra-qa-h">
          <h2 id="dra-qa-h" className="dra-h2">
            Quick answers
          </h2>
          <dl className="dra-qa-list">
            <div className="dra-qa-row">
              <dt>Why does this page exist?</dt>
              <dd>
                It republishes a filing this provider made with CMS, published at{' '}
                <a
                  href="https://npiregistry.cms.hhs.gov/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  npiregistry.cms.hhs.gov
                </a>
                . VitalCV did not create the filing and does not confirm it.
              </dd>
            </div>
            <div className="dra-qa-row">
              <dt>Want this page removed?</dt>
              <dd>
                Email <a href="mailto:privacy@vitalcv.com">privacy@vitalcv.com</a> and we will
                stop pointing search engines at this page and mark it not to be indexed. We
                cannot change or remove the CMS filing itself &mdash; that stays with CMS, and
                you can correct it with them.
              </dd>
            </div>
          </dl>
        </section>

        {/* For whoever read the whole chart: the quiet way back to the one
            action. An anchor, not a second funnel-wired CTA — the claim click
            stays a single, honest funnel event. */}
        {isIndividual ? (
          <div className="dra-final" data-dra-reveal>
            <a className="dra-final-link" href="#claim">
              Is this you? Claim this record <span aria-hidden="true">↑</span>
            </a>
          </div>
        ) : null}

        <footer className="dra-foot">
          <p>
            Employers reviewing this clinician can see source coverage and verification history
            on the{' '}
            <Link href={`/verify/${record.npi}`}>verification view</Link>.
          </p>
        </footer>
      </main>
    </div>
  );
}
