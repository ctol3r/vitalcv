import { GardenShell } from '@/components/career-garden/GardenShell';
import { LivingCvSurface } from '@/components/career-garden/surfaces/LivingCvSurface';

export const metadata = {
  title: 'Living CV · Career Garden · VitalCV',
};

export default async function CareerGardenCvPage({
  searchParams,
}: {
  searchParams: Promise<{ entry?: string }>;
}) {
  const sp = await searchParams;
  return (
    <GardenShell active="cv" mount="holder">
      <LivingCvSurface selectedId={sp.entry} mount="holder" />
    </GardenShell>
  );
}
