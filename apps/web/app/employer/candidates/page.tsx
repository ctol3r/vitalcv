import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FEATURES } from '@/lib/features';
import { CandidatePoolSurface } from '@/components/matcha/employer/CandidatePoolSurface';

export const metadata: Metadata = {
  title: 'Credential-ready clinicians',
  description: 'Browse a pool of clinicians with source-backed readiness and start a review.',
};

export default function EmployerCandidatesPage() {
  if (!FEATURES.MATCHA_V2) notFound();
  return <CandidatePoolSurface />;
}
