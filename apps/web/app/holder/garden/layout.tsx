import { GardenCursor } from '@/components/career-garden/GardenCursor';
import { GardenWorkspaceProvider } from '@/components/career-garden/GardenWorkspaceProvider';

/**
 * Career Garden layout. Auth comes from the /holder layout above (Clerk +
 * middleware role gate); this layer adds the session-only workspace state
 * and the Cursor. The provider lives here so approvals and captures survive
 * navigation between garden sections — and nowhere else, so they clear the
 * moment the clinician leaves.
 */
export default function CareerGardenLayout({ children }: { children: React.ReactNode }) {
  return (
    <GardenWorkspaceProvider>
      {children}
      <GardenCursor mount="holder" />
    </GardenWorkspaceProvider>
  );
}
