import { GardenCursor } from '@/components/career-garden/GardenCursor';
import { GardenWorkspaceProvider } from '@/components/career-garden/GardenWorkspaceProvider';
import { loadGardenData } from '@/lib/career-garden/serverSource';

/**
 * Career Garden layout. Auth comes from the /holder layout above (Clerk +
 * middleware role gate); this layer loads the clinician's durable garden
 * data once per request (shared with every garden page via React cache)
 * and mounts the Cursor. Mutations go through the /api/profile/garden
 * proxies and re-render this tree from the source of truth.
 */
export default async function CareerGardenLayout({ children }: { children: React.ReactNode }) {
  const data = await loadGardenData();
  return (
    <GardenWorkspaceProvider initial={data}>
      {children}
      <GardenCursor mount="holder" />
    </GardenWorkspaceProvider>
  );
}
