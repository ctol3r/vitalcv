import { GardenShell } from '@/components/career-garden/GardenShell';
import { GardenHomeSurface } from '@/components/career-garden/surfaces/GardenHomeSurface';
import { loadGardenData } from '@/lib/career-garden/serverSource';

export const metadata = {
  title: 'Career Garden · VitalCV',
};

export default async function CareerGardenHomePage() {
  const data = await loadGardenData();
  return (
    <GardenShell active="home" mount="holder" mode={data.mode}>
      <GardenHomeSurface data={data} mount="holder" />
    </GardenShell>
  );
}
