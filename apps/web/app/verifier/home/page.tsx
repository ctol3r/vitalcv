import { EmployerDashboard } from '@/components/employer/EmployerDashboard';

// Auth is handled by app/verifier/layout.tsx — no need to gate here.
export default function VerifierHomePage() {
  return <EmployerDashboard />;
}
