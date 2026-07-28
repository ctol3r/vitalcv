import { GardenShell } from '@/components/career-garden/GardenShell';
import { NotesSurface } from '@/components/career-garden/surfaces/NotesSurface';

export const metadata = {
  title: 'Notes · Career Garden · VitalCV',
};

export default async function CareerGardenNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string; grow?: string }>;
}) {
  const sp = await searchParams;
  return (
    <GardenShell active="notes" mount="holder">
      <NotesSurface selectedId={sp.note} grow={sp.grow === '1'} mount="holder" />
    </GardenShell>
  );
}
