import { proxyGardenPath } from '@/lib/server/garden-workbench-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ noteId: string }> }) {
  const { noteId } = await params;
  return proxyGardenPath(`/api/profile/garden/notes/${encodeURIComponent(noteId)}/links`, 'GET');
}
