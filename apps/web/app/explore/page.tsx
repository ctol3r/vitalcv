import type { Metadata } from 'next';
import { BoardClient } from '@/components/explore/board/BoardClient';
import { PageFrame } from '@/components/layout/PageFrame';
import { parseBoardFilters, toApiQuery } from '@/lib/explore/board-filters';
import { fetchPublicOpportunityField } from '@/lib/launch/marketplace';
import '@/styles/opportunity-field.css';

export const revalidate = 300;

const TITLE = 'Clinical opportunities — source in view';
const DESCRIPTION =
  'Browse current clinical roles with the original source, observation time, availability, compensation source, and application path in view.';

export const metadata: Metadata = {
  title: { absolute: `${TITLE} | VitalCV` },
  description: DESCRIPTION,
  alternates: { canonical: 'https://vitalcv.com/explore' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: 'https://vitalcv.com/explore',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'string') params.set(key, first);
  }
  const initial = await fetchPublicOpportunityField(toApiQuery(parseBoardFilters(params)));

  return (
    <div className="opf-page" data-surface-tier="public">
      <PageFrame as="main" mode="marketing" className="opf-frame">
        <header className="opf-hero">
          <div className="opf-hero-copy">
            <p className="opf-eyebrow">Clinician opportunities</p>
            <h1>Find clinical work with the source in view.</h1>
            <p className="opf-hero-lede">
              Shape the field by profession, specialty, setting, source observation,
              compensation detail, and application path. Every listing keeps its source,
              availability, and limitations attached.
            </p>
            <div className="opf-hero-boundary" aria-label="Opportunity field boundaries">
              <p>
                <span aria-hidden="true">01</span>
                No account required
              </p>
              <p>
                <span aria-hidden="true">02</span>
                No public eligibility verdict
              </p>
              <p>
                <span aria-hidden="true">03</span>
                External roles return to the source
              </p>
            </div>
          </div>
        </header>

        <BoardClient initial={initial} />
      </PageFrame>
    </div>
  );
}
