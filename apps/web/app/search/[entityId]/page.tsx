import SearchClient from './SearchClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  robots: { index: false, follow: false },
  title: 'Search · VitalCV',
  description: 'Unified search across a clinician’s career ecosystem — evidence, organizations, and career events.',
};

export default async function SearchPage({ params }: { params: Promise<{ entityId: string }> }) {
  const { entityId } = await params;
  return <SearchClient entityId={entityId} />;
}
