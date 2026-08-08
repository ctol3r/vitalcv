import { GardenShell } from '@/components/career-garden/GardenShell';
import { workbenchSectionTitle } from '@/lib/career-garden/branding';
import { OpportunitiesSurface } from '@/components/career-garden/surfaces/OpportunitiesSurface';
import { loadGardenData } from '@/lib/career-garden/serverSource';

export const metadata = {
  title: workbenchSectionTitle('Opportunities'),
};

export default async function CareerGardenOpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ op?: string; compose?: string }>;
}) {
  const [sp, data] = await Promise.all([searchParams, loadGardenData()]);
  return (
    <GardenShell active="opportunities" mount="holder" mode={data.mode}>
      <OpportunitiesSurface data={data} selectedId={sp.op} compose={sp.compose === '1'} mount="holder" />
    </GardenShell>
  );
}
