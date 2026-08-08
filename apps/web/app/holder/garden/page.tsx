import { GardenShell } from '@/components/career-garden/GardenShell';
import { WORKBENCH_BRANDING } from '@/lib/career-garden/branding';
import { GardenHomeSurface } from '@/components/career-garden/surfaces/GardenHomeSurface';
import { loadGardenData } from '@/lib/career-garden/serverSource';

export const metadata = {
  title: WORKBENCH_BRANDING.titleBase,
};

export default async function CareerGardenHomePage() {
  const data = await loadGardenData();
  return (
    <GardenShell active="home" mount="holder" mode={data.mode}>
      <GardenHomeSurface data={data} mount="holder" />
    </GardenShell>
  );
}
