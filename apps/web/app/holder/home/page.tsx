import type { Metadata } from 'next';
import ClinicianHomeSurface from '@/components/mobile/ClinicianHomeSurface';

export const metadata: Metadata = {
  title: 'Your Workspace — VitalCV',
  description: 'Your clinician mobile home surface.',
};

export default function HolderHomePage() {
  return <ClinicianHomeSurface />;
}
