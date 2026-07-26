/**
 * /design/proof-packet — the interactive proof moment (design reference, SHD-4.2)
 *
 * Inspect a representative claim's full chain — claim → source → retrieval /
 * receipt → state → limitation — from VitalCV's real evidence grammar.
 * Explicitly illustrative; the employer-final boundary is stated.
 *
 * Design Handoff References:
 *   VitalCV_Shader_Master_Claude_Code_Tasklist (SHD-4.2)
 *   docs/design/evidence-surface-fieldguide.html
 */

import type { Metadata } from 'next';
import { ProofPacketInspector } from '@/components/proof/ProofPacketInspector';

export const metadata: Metadata = {
  title: 'The proof moment — inspect a claim',
  description:
    'Inspect a representative proof-packet claim end to end: source, retrieval, receipt, state, and limitation — the evidence grammar an employer reviews from.',
  robots: { index: false, follow: false },
};

export default function ProofPacketDesignReferencePage() {
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '56px 24px 96px', color: 'var(--vt-text-primary)' }}>
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
        Homepage · SHD-4.2
      </p>
      <h1 style={{ margin: '0 0 14px', fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
        See how one claim holds up
      </h1>
      <p style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--vt-text-secondary)', maxWidth: '62ch', margin: '0 0 28px' }}>
        Not a dashboard of numbers — a look at the <strong style={{ color: 'var(--vt-text-primary)' }}>chain behind a claim</strong>:
        where it came from, how it was retrieved, the receipt, its current state, and exactly what it does and does not
        establish. Pick a claim to inspect it.
      </p>

      <ProofPacketInspector />

      <p style={{ marginTop: 20, fontSize: 12.5, lineHeight: 1.6, color: 'var(--vt-text-muted)', maxWidth: '64ch' }}>
        The values above are illustrative. Enter your NPI on the homepage to inspect your own evidence — a source that was
        not read is shown as not read, and no result is a completed credentialing decision.
      </p>
    </main>
  );
}
