import type { Metadata } from 'next';
import ClinicianApplicationsSurface from '@/components/mobile/ClinicianApplicationsSurface';

export const metadata: Metadata = {
  title: 'Applications — VitalCV',
  description: 'Live clinician application detail and next steps.',
};

export default function ApplicationsPage() {
  return <ClinicianApplicationsSurface />;
}
