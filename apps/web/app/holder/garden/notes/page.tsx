import { GardenShell } from '@/components/career-garden/GardenShell';
import { workbenchSectionTitle } from '@/lib/career-garden/branding';
import { NotesSurface } from '@/components/career-garden/surfaces/NotesSurface';
import { loadGardenData } from '@/lib/career-garden/serverSource';

export const metadata = {
  title: workbenchSectionTitle('Notes'),
};

export default async function CareerGardenNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string; grow?: string }>;
}) {
  const [sp, data] = await Promise.all([searchParams, loadGardenData()]);
  return (
    <GardenShell active="notes" mount="holder" mode={data.mode}>
      <NotesSurface data={data} selectedId={sp.note} grow={sp.grow === '1'} mount="holder" />
    </GardenShell>
  );
}
