import PassportEntityClient from './PassportEntityClient';
import { getDemoPassport } from '@/lib/demo/seedDemoPassport';
import { DEMO_PASSPORT_BANNER_COPY } from '@/lib/demo/demoPassportFixture';

export const dynamic = 'force-dynamic';

export default async function PassportEntityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const demo = getDemoPassport(id);

  if (demo) {
    return (
      <PassportEntityClient
        entityId={id}
        initialPassport={demo.passport}
        demoBanner={DEMO_PASSPORT_BANNER_COPY}
      />
    );
  }

  return <PassportEntityClient entityId={id} />;
}
