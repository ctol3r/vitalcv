import { GardenShell } from '@/components/career-garden/GardenShell';
import { OpportunitiesSurface } from '@/components/career-garden/surfaces/OpportunitiesSurface';

export const metadata = {
  title: 'Opportunities · Career Garden · VitalCV',
};

export default async function CareerGardenOpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ op?: string; compose?: string }>;
}) {
  const sp = await searchParams;
  return (
    <GardenShell active="opportunities" mount="holder">
      <OpportunitiesSurface selectedId={sp.op} compose={sp.compose === '1'} mount="holder" />
    </GardenShell>
  );
}
