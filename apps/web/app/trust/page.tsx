import type { Metadata } from 'next';
import { getTrustRegisterSnapshot } from '@/lib/trust/register';
import { TrustStateRegister } from '@/components/trust/TrustStateRegister';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Trust State Register — VitalCV',
  description:
    'Institutional trust surface for VitalCV credential verification. Three trust states, T1-T4 proof tiers, full lineage.',
};

export default async function TrustPage() {
  const snapshot = await getTrustRegisterSnapshot();
  return <TrustStateRegister snapshot={snapshot} />;
}
