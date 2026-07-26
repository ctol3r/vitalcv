import type { Metadata } from 'next';
import ClinicianOpportunitiesSurface from '@/components/mobile/ClinicianOpportunitiesSurface';

export const metadata: Metadata = {
  title: 'Opportunities',
  description: 'Roles matched to your VitalCV readiness.',
};

// Renders the "Roles" tab of the clinician bottom nav. Data comes from the
// shared ClinicianMobileProvider loaded in app/holder/layout.tsx.
export default function HolderOpportunitiesPage() {
  return <ClinicianOpportunitiesSurface />;
}
