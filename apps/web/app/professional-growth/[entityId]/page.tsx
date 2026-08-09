import ProfessionalGrowthClient from './ProfessionalGrowthClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Professional Growth',
  description: 'A clinician’s career arc — milestones, progression, and growth-readiness gaps.',
  robots: { index: false, follow: false },
};

export default async function ProfessionalGrowthPage({ params }: { params: Promise<{ entityId: string }> }) {
  const { entityId } = await params;
  return <ProfessionalGrowthClient entityId={entityId} />;
}
