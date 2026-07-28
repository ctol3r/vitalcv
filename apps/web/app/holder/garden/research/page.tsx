import { GardenShell } from '@/components/career-garden/GardenShell';
import { ResearchSurface } from '@/components/career-garden/surfaces/ResearchSurface';

export const metadata = {
  title: 'Research · Career Garden · VitalCV',
};

export default async function CareerGardenResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string }>;
}) {
  const sp = await searchParams;
  return (
    <GardenShell active="research" mount="holder">
      <ResearchSurface selectedId={sp.item} mount="holder" />
    </GardenShell>
  );
}
