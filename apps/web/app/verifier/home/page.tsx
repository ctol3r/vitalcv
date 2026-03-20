import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { EmployerDashboard } from '@/components/employer/EmployerDashboard';

export const metadata: Metadata = {
  title: 'Employer Dashboard — VitalCV',
  description: 'Review live VitalCV applications, providers, findings, storylines, and actions.',
};

export default async function VerifierHomePage() {
  const session = await auth();

  if (!session.userId) {
    redirect('/sign-in?redirect_url=%2Fverifier%2Fhome');
  }

  return <EmployerDashboard />;
}
