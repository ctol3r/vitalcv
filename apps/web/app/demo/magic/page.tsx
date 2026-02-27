import { MagicOnboarding } from '@/components/clinician/MagicOnboarding';
import Navbar from '@/components/marketing/Navbar';

export const metadata = { title: 'Magic Onboarding — VitalCV' };

export default function MagicDemoPage() {
  return (
    <div className="min-h-screen bg-[var(--background,#f0eee9)]">
      <Navbar />

      <main className="pt-24 pb-20 px-4">
        <div className="max-w-lg mx-auto">
          {/* Page header */}
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Wave 12 · Document Intelligence
            </p>
            <h1 className="text-3xl font-bold text-foreground">Magic Onboarding</h1>
            <p className="text-base text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">
              Drop a credential PDF and watch AI extract your data in seconds — no manual entry.
            </p>
          </div>

          {/* Component under test */}
          <MagicOnboarding />
        </div>
      </main>
    </div>
  );
}
