import { VerifierCommandCenter } from '@/components/employer/VerifierCommandCenter';
import Navbar from '@/components/marketing/Navbar';

export const metadata = { title: 'Command Center Demo — VitalCV' };

export default function CommandCenterDemoPage() {
  return (
    <div className="min-h-screen bg-[var(--background,#f0eee9)]">
      <Navbar />

      <main className="pt-24 pb-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Wave 10 · Employer Command Center
            </p>
            <h1 className="text-3xl font-bold text-foreground">
              Live Credential Intake
            </h1>
            <p className="text-base text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
              Select a candidate and run Instant Approve with zero-knowledge proof verification.
            </p>
          </div>

          <VerifierCommandCenter />
        </div>
      </main>
    </div>
  );
}
