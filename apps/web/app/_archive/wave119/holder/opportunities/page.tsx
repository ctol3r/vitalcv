import type { Metadata } from 'next';
import ClinicianOpportunitiesSurface from '@/components/mobile/ClinicianOpportunitiesSurface';

export const metadata: Metadata = {
  title: 'Matched Opportunities',
  description: 'Live clinician opportunities with apply continuity.',
};

export default function HolderOpportunitiesPage() {
  return <ClinicianOpportunitiesSurface />;
}
