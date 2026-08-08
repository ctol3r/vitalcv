import { proxyGardenPath } from '@/lib/server/garden-workbench-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ noteId: string; revisionId: string }> },
) {
  const { noteId, revisionId } = await params;
  return proxyGardenPath(
    `/api/profile/garden/notes/${encodeURIComponent(noteId)}/revisions/${encodeURIComponent(revisionId)}/restore`,
    'POST',
    '{}',
  );
}
