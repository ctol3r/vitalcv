import EcosystemHomeClient from './EcosystemHomeClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  robots: { index: false, follow: false },
  title: 'Career Ecosystem',
  description: 'The operating system for a healthcare career — evidence, trust, mobility, organizations, and activity in one view.',
};

export default async function EcosystemHomePage({
  params,
}: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await params;
  return <EcosystemHomeClient entityId={entityId} />;
}
