import PacketClient from './PacketClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Career Packet · VitalCV',
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
