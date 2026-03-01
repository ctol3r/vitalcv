import { VerifierPortal } from '@/components/employer/VerifierPortal';
import Navbar from '@/components/marketing/Navbar';

export const metadata = { title: 'Verifier Portal Demo — VitalCV' };

export default function VerifierPortalDemoPage() {
  return (
    <div className="min-h-screen bg-[var(--background,#f0eee9)]">
      <Navbar />

      <main className="pt-24 pb-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Wave 11 · Continuous Monitoring
            </p>
            <h1 className="text-3xl font-bold text-foreground">Verifier Portal</h1>
            <p className="text-base text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
              Full employer verification command center with revocation simulation.
            </p>
          </div>

          <VerifierPortal />
        </div>
      </main>
    </div>
  );
}
