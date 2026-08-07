import { GardenShell } from '@/components/career-garden/GardenShell';
import { LivingCvSurface } from '@/components/career-garden/surfaces/LivingCvSurface';
import { loadGardenData } from '@/lib/career-garden/serverSource';

export const metadata = {
  title: 'Living CV · Career Garden · VitalCV',
};

export default async function CareerGardenCvPage({
  searchParams,
}: {
  searchParams: Promise<{ entry?: string }>;
}) {
  const [sp, data] = await Promise.all([searchParams, loadGardenData()]);
  return (
    <GardenShell active="cv" mount="holder" mode={data.mode}>
      <LivingCvSurface data={data} selectedId={sp.entry} mount="holder" />
    </GardenShell>
  );
}
