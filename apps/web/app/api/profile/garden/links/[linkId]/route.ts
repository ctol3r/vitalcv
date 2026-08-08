import { proxyGardenPath } from '@/lib/server/garden-workbench-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(_req: Request, { params }: { params: Promise<{ linkId: string }> }) {
  const { linkId } = await params;
  return proxyGardenPath(`/api/profile/garden/links/${encodeURIComponent(linkId)}`, 'DELETE');
}
