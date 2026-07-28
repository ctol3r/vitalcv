import { GardenShell } from '@/components/career-garden/GardenShell';
import { GardenHomeSurface } from '@/components/career-garden/surfaces/GardenHomeSurface';

export const metadata = {
  title: 'Career Garden · VitalCV',
};

export default function CareerGardenHomePage() {
  return (
    <GardenShell active="home" mount="holder">
      <GardenHomeSurface mount="holder" />
    </GardenShell>
  );
}
