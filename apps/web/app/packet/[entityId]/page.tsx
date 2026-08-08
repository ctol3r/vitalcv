import PacketClient from './PacketClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  robots: { index: false, follow: false },
  title: 'Career Packet',
  description: 'Source-backed clinician career readiness packet for recruiter and employer review.',
};

export default async function CareerPacketPage({
  params,
}: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await params;
  return <PacketClient entityId={entityId} />;
}
