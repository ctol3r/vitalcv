import type { Metadata } from 'next';
import NpiProfileComposer from '@/components/profile/NpiProfileComposer';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Build profile from NPI · VitalCV',
  description: 'Create a provenance-aware clinician profile draft from a current CMS NPPES record.',
  robots: { index: false, follow: false },
};

export default function NpiProfileComposerPage() {
  return <NpiProfileComposer />;
}
