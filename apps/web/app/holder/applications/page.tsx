import type { Metadata } from 'next';
import ClinicianApplicationsSurface from '@/components/mobile/ClinicianApplicationsSurface';

export const metadata: Metadata = {
  title: 'Applications',
  description: 'Track your applications and where each one stands.',
};

// Renders the "Updates" tab of the clinician bottom nav. Data comes from the
// shared ClinicianMobileProvider loaded in app/holder/layout.tsx.
export default function HolderApplicationsPage() {
  return <ClinicianApplicationsSurface />;
}
