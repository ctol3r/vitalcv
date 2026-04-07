/**
 * DEMO ARTIFACT — Verifier Portal (Legacy Wave 11 UI)
 *
 * ⚠ CONTRACTOR NOTE: This page uses seeded/hardcoded data.
 * It is NOT connected to live passport, trust state, or employer review routes.
 *
 * The production employer review flow is at:
 *   /review/[entityId]  →  ReviewClient.tsx  →  /api/employer-review/:entityId/*
 *
 * This page exists for visual reference only.
 */
import Link from 'next/link';
import { VerifierPortal } from '@/components/employer/VerifierPortal';

export const metadata = { title: 'Verifier Portal (Demo Artifact)' };

export default function VerifierPortalDemoPage() {
  return (
    <div className="min-h-screen bg-[var(--background,#f0eee9)]">
      {/* Demo artifact banner */}
      <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-xs font-semibold text-amber-800">
        ⚠ DEMO ARTIFACT — Seeded data only. Production flow: <Link href="/review" className="underline">/review/[entityId]</Link>
      </div>
      <main className="px-4 py-12 sm:py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Verifier Portal — Demo Artifact
            </p>
            <h1 className="text-3xl font-bold text-foreground">Verifier Portal</h1>
            <p className="text-base text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
              Visual reference for the continuous monitoring surface.
              Real monitoring uses <a href="/mission-ops" className="underline text-blue-600">/mission-ops</a>.
            </p>
          </div>

          <VerifierPortal />
        </div>
      </main>
    </div>
  );
}
