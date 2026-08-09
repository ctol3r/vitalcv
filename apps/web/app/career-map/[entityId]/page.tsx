import CareerMapClient from './CareerMapClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  robots: { index: false, follow: false },
  title: 'Career Map',
  description: 'A navigable map of a clinician’s career — evidence, sources, organizations, and trust, connected.',
};

export default async function CareerMapPage({ params }: { params: Promise<{ entityId: string }> }) {
  const { entityId } = await params;
  return <CareerMapClient entityId={entityId} />;
}
