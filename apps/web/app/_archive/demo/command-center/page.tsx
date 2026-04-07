/**
 * DEMO ARTIFACT — Command Center (Legacy Wave 10 UI)
 *
 * ⚠ CONTRACTOR NOTE: This page uses seeded/hardcoded candidate data.
 * It is NOT connected to live passport, trust state, or employer review routes.
 *
 * The production employer review flow is at:
 *   /review/[entityId]  →  ReviewClient.tsx  →  /api/employer-review/:entityId/*
 *
 * This page exists for visual reference only. Do not wire it to real data.
 * Real audit trail: POST /api/employer-review/:entityId/accept writes to AuditEvent.
 */
import Link from 'next/link';
import { VerifierCommandCenter } from '@/components/employer/VerifierCommandCenter';

export const metadata = { title: 'Command Center (Demo Artifact)' };

export default function CommandCenterDemoPage() {
  return (
    <div className="min-h-screen bg-[var(--background,#f0eee9)]">
      {/* Demo artifact banner */}
      <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-xs font-semibold text-amber-800">
        ⚠ DEMO ARTIFACT — Seeded data only. Not connected to live trust pipeline.
        Production flow: <Link href="/review" className="underline">/review/[entityId]</Link>
      </div>
      <main className="px-4 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Employer Command Center — Demo Artifact
            </p>
            <h1 className="text-3xl font-bold text-foreground">
              Credential Intake (Seeded Data)
            </h1>
            <p className="text-base text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
              Visual reference for the employer verification surface.
              Real accept/review decisions use the <Link href="/review" className="underline text-blue-600">/review</Link> route.
            </p>
          </div>

          <VerifierCommandCenter />
        </div>
      </main>
    </div>
  );
}
