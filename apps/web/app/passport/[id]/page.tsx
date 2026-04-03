import PassportEntityClient from './PassportEntityClient';

export const dynamic = 'force-dynamic';

export default async function PassportEntityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PassportEntityClient entityId={id} />;
}
