import type { Metadata } from 'next';
import { EmployerWorkflowDashboard } from '@/components/employer/EmployerWorkflowDashboard';

export const metadata: Metadata = {
  title: 'Employer applications',
  description: 'Review employer-authorized applications and their submitted VitalCV evidence packets.',
};

export const dynamic = 'force-dynamic';

export default function EmployerApplicationsPage() {
  return <EmployerWorkflowDashboard />;
}
