import type { Metadata } from 'next';
import Link from 'next/link';
import { ArtifactStage } from '@/components/motion/ArtifactStage';
import { DecisionArtifact } from '@/components/artifacts/PageArtifacts';
import '@/styles/motion.css';
import '@/styles/artifact-motion.css';
import { EmployerEvidenceSection } from '@/components/employers/EmployerEvidenceSection';
import { PageFrame } from '@/components/layout/PageFrame';

/**
 * /employers/how-it-works — the lane register and the illustrative packet.
 *
 * Moved off /employers by the 2026-08-06 founder experience audit: the full
 * register is reference material — exactly right for the credentialing leader
 * with a diligence question, and reference-documentation density for everyone
 * else. The landing page keeps a registry-derived hand-off; this page carries
 * the whole artifact.
 *
 * The honesty split lives in `EmployerEvidenceSection` and is unchanged:
 * the lane register is REAL (read from SOURCE_LANE_OPS, the registry behind
 * /status — it cannot drift from lane truth), and the packet below it is
 * ILLUSTRATIVE and says so on every artifact.
 */

// Bound external shared-cache staleness to 5 min (see app/page.tsx note).
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'How it works — what arrives, source by source · VitalCV',
  description:
    'Every evidence lane VitalCV reads — what it returns, when it was read, and what it does not decide — plus what a reviewed, consented packet looks like.',
};

export default function EmployerHowItWorksPage() {
  return (
    <div className="mz mz-paper mz-persona-employer min-h-screen">
      <PageFrame as="main" mode="marketing">
        <header className="mb-5">
          <p className="mz-eyebrow">For employers &amp; verifiers</p>
          <h1 className="mz-h1" style={{ marginTop: 12, maxWidth: 680 }}>
            What arrives, <span className="mz-accent">source by source</span>.
          </h1>
          <p className="mz-lede" style={{ marginTop: 12, maxWidth: 620 }}>
            Every lane below is read from the same registry that drives /status — what it returns,
            when it was read, and what it does not decide. The packet beneath is an example, and
            says so.
          </p>
        </header>

        {/* What the reviewer actually receives: claims carrying their sources,
            and the three actions that stay visibly the reviewer's. Moved here
            from the landing page with the rest of the packet anatomy — this is
            the page that shows the work. Plays once on entry, then rests. */}
        <section aria-label="What a reviewer receives" className="mt-8">
          <ArtifactStage glass>
            <DecisionArtifact />
          </ArtifactStage>
        </section>

        <EmployerEvidenceSection />

        <section className="mz-card mt-12 p-5 sm:p-6" aria-label="Request organization access">
          <p className="mz-eyebrow">Next step</p>
          <h2 className="mz-h2" style={{ marginTop: 8 }}>
            Request access to your organization
          </h2>
          <p className="mz-small" style={{ marginTop: 4, marginBottom: 16, maxWidth: 620 }}>
            Resolve your organization against the federal registry and request access — a request
            that has to be granted, never a claim.
          </p>
          <p>
            <Link href="/employers/request-access" className="mz-btn">
              Request organization access
            </Link>
          </p>
        </section>

        <p className="mt-6 text-center text-xs text-[var(--vt-text-muted)]">
          <Link href="/employers" className="underline underline-offset-2 hover:text-[var(--vt-text-primary)]">
            Back to the employer overview
          </Link>{' '}
          · Diligence question?{' '}
          <Link href="/trust/attribution" className="underline underline-offset-2 hover:text-[var(--vt-text-primary)]">
            Read the per-field source register
          </Link>
        </p>
      </PageFrame>
    </div>
  );
}
