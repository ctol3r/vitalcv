/**
 * /design/verify — Two-half verify verdict (design reference, W4)
 *
 * The public verify verdict split into Integrity (does the math hold?) and
 * Issuer legitimacy (is the signer real?), never one green banner. Revocation
 * is a visible step (canonical ProvenanceChip `revoked` register); a revoked
 * credential renders a full stop.
 *
 * Design Handoff References:
 *   docs/design/ui-ux-inspiration-repository-2026-07-17.md  (V1, V4, V5)
 *   docs/design/evidence-surface-fieldguide.html            (verify spec)
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { VerdictSplit, type VerdictItem } from '@/design-system/components';

export const metadata: Metadata = {
  title: 'Two-half verify verdict — design reference',
  description:
    'The public verify verdict split into integrity and issuer legitimacy, with revocation as a visible step and a fail-closed revoked state.',
  robots: { index: false, follow: false },
};

const CLEAN_INTEGRITY: VerdictItem[] = [
  { label: 'Signature valid · ES256', status: 'pass', provenance: 'did:web:vitalcv.com · key vcv-es256-1' },
  { label: 'Disclosure set intact', status: 'pass', detail: 'no unreferenced disclosures' },
  { label: 'Inclusion proven to root', status: 'pass', provenance: 'merkle root 4d2e…9a1' },
];
const CLEAN_ISSUER: VerdictItem[] = [
  { label: 'Issued by vitalcv.com', status: 'pass', provenance: 'registry entry 2026-06-02' },
  { label: 'Issuer key current', status: 'pass', detail: 'not rotated out' },
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

export default function VerifyDesignReferencePage() {
  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '56px 24px 96px', color: 'var(--vt-text-primary)' }}>
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
        Design system · W4
      </p>
      <h1 style={{ margin: '0 0 14px', fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
        Two questions, never one banner
      </h1>
      <p style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--vt-text-secondary)', maxWidth: '60ch', margin: 0 }}>
        A credential has to answer two separate questions: does the <strong style={{ color: 'var(--vt-text-primary)' }}>math hold</strong>,
        and is the <strong style={{ color: 'var(--vt-text-primary)' }}>signer real</strong>. Collapsing them into a single
        green &ldquo;verified&rdquo; hides the case that matters most — a valid signature from an issuer no one recognizes.
      </p>

      <Section eyebrow="V4" title="Verifiable — integrity holds, issuer recognized">
        <VerdictSplit
          integrity={CLEAN_INTEGRITY}
          issuer={CLEAN_ISSUER}
          revocation={{ state: 'none-found', source: 'status list', checkedAt: '2026-07-17T14:32:00Z' }}
        />
      </Section>

      <Section eyebrow="V4 · the case one banner hides" title="Mixed — signature valid, issuer unrecognized">
        <VerdictSplit
          integrity={CLEAN_INTEGRITY}
          issuer={[
            { label: 'Issuer not in registry', status: 'mixed', detail: 'did:web:example.org — unrecognized', provenance: 'no registry entry' },
          ]}
          revocation={{ state: 'unknown', source: 'issuer unrecognized' }}
        />
      </Section>

      <Section eyebrow="V5 · fail-closed" title="Revoked — a full stop">
        <VerdictSplit
          integrity={CLEAN_INTEGRITY}
          issuer={CLEAN_ISSUER}
          revocation={{ state: 'revoked', source: 'issuer status list', checkedAt: '2026-06-30T00:00:00Z' }}
        />
        <p style={{ marginTop: 12, fontSize: 12.5, lineHeight: 1.6, color: 'var(--vt-text-secondary)', maxWidth: '58ch' }}>
          Even when the signature and issuer both check out, a withdrawn credential fails closed — it can never read as
          merely &ldquo;unavailable.&rdquo; The custody history stays visible for audit; the credential does not.
        </p>
      </Section>

      <Section eyebrow="V5" title="Integrity failure — located, not generic">
        <VerdictSplit
          integrity={[
            { label: 'Signature valid · ES256', status: 'pass', provenance: 'did:web:vitalcv.com' },
            { label: 'Digest set — event 002 modified', status: 'fail', detail: 'content hash mismatch', provenance: 'expected 7f3c…8d' },
          ]}
          issuer={CLEAN_ISSUER}
          revocation={{ state: 'none-found', source: 'status list', checkedAt: '2026-07-17T14:32:00Z' }}
        />
      </Section>
    </main>
  );
}
