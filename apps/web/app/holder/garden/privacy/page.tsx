import { GardenShell } from '@/components/career-garden/GardenShell';
import { workbenchSectionTitle } from '@/lib/career-garden/branding';
import { PrivacySurface } from '@/components/career-garden/surfaces/PrivacySurface';
import { loadGardenData } from '@/lib/career-garden/serverSource';

export const metadata = {
  title: workbenchSectionTitle('Privacy & connections'),
};

export default async function CareerGardenPrivacyPage() {
  const data = await loadGardenData();
  return (
    <GardenShell active="privacy" mount="holder" mode={data.mode}>
      <PrivacySurface mount="holder" />
    </GardenShell>
  );
}
