import NetworkClient from './NetworkClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  robots: { index: false, follow: false },
  title: 'My Network',
  description: 'The organizations connected to a clinician — training institutions, credential issuers, licensing boards, and verification authorities.',
};

export default async function NetworkPage({ params }: { params: Promise<{ entityId: string }> }) {
  const { entityId } = await params;
  return <NetworkClient entityId={entityId} />;
}
