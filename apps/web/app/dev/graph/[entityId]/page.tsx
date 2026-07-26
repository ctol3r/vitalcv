import GraphExplorerClient from './GraphExplorerClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Evidence Graph Explorer (dev) · VitalCV',
  robots: { index: false, follow: false },
};

/**
 * Developer-only inspector for the evidence GraphProjection (Wave 221, C6).
 * Not a production surface — plain node/relationship/JSON view for debugging.
 */
export default async function GraphExplorerPage({
  params,
}: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await params;
  return <GraphExplorerClient entityId={entityId} />;
}
