import { GardenShell } from '@/components/career-garden/GardenShell';
import { PrivacySurface } from '@/components/career-garden/surfaces/PrivacySurface';

export const metadata = {
  title: 'Privacy & connections · Career Garden · VitalCV',
};

export default function CareerGardenPrivacyPage() {
  return (
    <GardenShell active="privacy" mount="holder">
      <PrivacySurface mount="holder" />
    </GardenShell>
  );
}
