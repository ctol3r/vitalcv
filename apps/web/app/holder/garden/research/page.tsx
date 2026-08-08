import { GardenShell } from '@/components/career-garden/GardenShell';
import { workbenchSectionTitle } from '@/lib/career-garden/branding';
import { ResearchSurface } from '@/components/career-garden/surfaces/ResearchSurface';
import { loadGardenData } from '@/lib/career-garden/serverSource';

export const metadata = {
  title: workbenchSectionTitle('Research'),
};

export default async function CareerGardenResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string }>;
}) {
  const [sp, data] = await Promise.all([searchParams, loadGardenData()]);
  return (
    <GardenShell active="research" mount="holder" mode={data.mode}>
      <ResearchSurface selectedId={sp.item} mount="holder" />
    </GardenShell>
  );
}
