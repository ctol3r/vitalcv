import { WalletDashboard } from '@/components/clinician/WalletDashboard';
import ImpactPanel from '@/components/impact/ImpactPanel';
import { fetchClinicianTrustState } from '@/lib/api';

const DEFAULT_NPI = '1003000126';

export default async function HolderPage() {
  const trustState = await fetchClinicianTrustState(DEFAULT_NPI);

  return (
    <>
      <WalletDashboard
        trustScore={trustState?.crs?.score ?? null}
        trustBand={trustState?.crs?.band ?? null}
      />
      <ImpactPanel npi={DEFAULT_NPI} />
    </>
  );
}
