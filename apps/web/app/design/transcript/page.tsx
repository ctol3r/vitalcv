/**
 * /design/transcript — Verification transcript (design reference, W5)
 *
 * The real Merkle-inclusion proof (the backend `verificationSteps`) rendered as
 * a stepwise trace. A tampered leaf yields a root MISMATCH — the transcript
 * names the exact break and fails closed, never a generic "verification failed".
 *
 * Design Handoff References:
 *   docs/design/ui-ux-inspiration-repository-2026-07-17.md  (A2, A3, T2)
 *   docs/design/evidence-surface-fieldguide.html            (transcript spec)
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { VerificationTranscript } from '@/design-system/components';

export const metadata: Metadata = {
  title: 'Verification transcript — design reference',
  description:
    'The Merkle-inclusion proof rendered as a stepwise trace, with a located, fail-closed mismatch state.',
  robots: { index: false, follow: false },
};

const ROOT = '4d2e91f0a7b3c6d84e2f1a9c0b7d3e6f5a8c1b4d7e0f3a6c9b2d5e8f1a4c7b0d3';

// Shape exactly as the backend buildVerificationSteps() emits it.
const VERIFIED_STEPS: string[] = [
  'Start: leaf = a1b9f2c4d7e0a3b6c9d2e5f8a1b4c7d0e3f6a9b2c5d8e1f4a7b0c3d6e9f2a5b8',
  'Level 1: H(a1b9f2c4… || 7f3c8d21…) = 5e2a91c40b7d3e6f8a1c…',
  'Level 2: H(5e2a91c4… || c40a1907…) = 9b2d5e8f1a4c7b0d3e6f…',
  'Level 3: H(9b2d5e8f… || 3e6f5a8c…) = 4d2e91f0a7b3c6d84e2f…',
  `Root matches: ${ROOT} ✓`,
];

const TAMPERED_STEPS: string[] = [
  'Start: leaf = 8f2ac41b0093a7e6d5c4b3a2918f7e6d5c4b3a2918f7e6d5c4b3a2918f7e6d5c',
  'Level 1: H(8f2ac41b… || 7f3c8d21…) = 1a2b3c4d5e6f7a8b9c0d…',
  'Level 2: H(1a2b3c4d… || c40a1907…) = 2b3c4d5e6f7a8b9c0d1e…',
  'Level 3: H(2b3c4d5e… || 3e6f5a8c…) = ff00aa11bb22cc33dd44…',
  `Root MISMATCH — expected ${ROOT}`,
];

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section style={{ borderTop: '1px solid var(--vt-border)', paddingTop: 28, marginTop: 40 }}>
      <div
        style={{
          fontFamily: 'var(--vt-font-mono, ui-monospace, monospace)',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          color: 'var(--vt-text-muted, var(--vt-text-secondary))',
          marginBottom: 8,
        }}
      >
        {eyebrow}
      </div>
      <h2 style={{ margin: '0 0 18px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</h2>
      {children}
    </section>
  );
}

export default function TranscriptDesignReferencePage() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '56px 24px 96px', color: 'var(--vt-text-primary)' }}>
      <p
        style={{
          fontFamily: 'var(--vt-font-mono, ui-monospace, monospace)',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.16em',
          color: 'var(--vt-accent, var(--vt-text-secondary))',
          margin: '0 0 16px',
        }}
      >
        Design system · W5
      </p>
      <h1 style={{ margin: '0 0 14px', fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
        Verification you can follow — and break
      </h1>
      <p style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--vt-text-secondary)', maxWidth: '60ch', margin: 0 }}>
        Proof-checking is not a badge. It is a trace: recompute the Merkle path from the leaf to the signed root, step by
        step. When a leaf has been tampered with, the transcript <strong style={{ color: 'var(--vt-text-primary)' }}>names
        the exact break</strong> and fails closed — never a generic &ldquo;verification failed.&rdquo;
      </p>

      <Section eyebrow="A2" title="Inclusion verified — the leaf belongs to the signed root">
        <VerificationTranscript steps={VERIFIED_STEPS} root={`${ROOT.slice(0, 12)}…`} />
      </Section>

      <Section eyebrow="T2 · fail-closed" title="Tampered leaf — the root mismatch is located">
        <VerificationTranscript steps={TAMPERED_STEPS} />
        <p style={{ marginTop: 12, fontSize: 12.5, lineHeight: 1.6, color: 'var(--vt-text-secondary)', maxWidth: '58ch' }}>
          The same trace, run against a modified leaf: the recomputed root diverges, so the last line reports a
          <code> MISMATCH</code> rather than a match. The proof stops there — it never rounds up to &ldquo;probably fine.&rdquo;
        </p>
      </Section>
    </main>
  );
}
