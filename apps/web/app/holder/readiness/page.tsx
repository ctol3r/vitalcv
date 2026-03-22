import type { Metadata } from 'next';
import ClinicianReadinessSurface from '@/components/mobile/ClinicianReadinessSurface';

export const metadata: Metadata = {
  title: 'Clinician Readiness — VitalCV',
  description: 'Live readiness score, history, and trust-state changes.',
};

export default function HolderReadinessPage() {
  return <ClinicianReadinessSurface />;
}
