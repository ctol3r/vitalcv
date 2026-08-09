import CareerIntelligenceClient from './CareerIntelligenceClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  robots: { index: false, follow: false },
  title: 'Career Intelligence',
  description: 'Deterministic, explainable career intelligence — insights, notifications, and prioritized actions.',
};

export default async function CareerIntelligencePage({ params }: { params: Promise<{ entityId: string }> }) {
  const { entityId } = await params;
  return <CareerIntelligenceClient entityId={entityId} />;
}
