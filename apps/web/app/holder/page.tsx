import { WalletDashboard } from '@/components/clinician/WalletDashboard';
import { GraphPreview } from '@/components/clinician/GraphPreview';
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
      <GraphPreview npi={DEFAULT_NPI} />
      <ImpactPanel npi={DEFAULT_NPI} />
    </>
  );
}
