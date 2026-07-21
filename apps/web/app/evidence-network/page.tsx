/**
 * /evidence-network — the Evidence Network as a public transparency surface
 * (SHD-0.3 quarantine).
 *
 * This route previously mounted the explorable force-directed graph with an
 * ILLUSTRATIVE clinician roster (synthetic "Dr. …" nodes) and physics/debug
 * controls. That is retired from public view: a healthcare trust product must
 * not show person-like nodes or graph-toy controls to anonymous visitors —
 * even labeled as illustrative. (The interactive graph remains available on
 * signed-in product surfaces, scoped to the viewer's own record.)
 *
 * What renders here instead is the evidence MODEL: the system concepts and
 * relationships that carry a clinician's career evidence — described in plain
 * DOM with no canvas, no synthetic people, and no fabricated results. Every
 * status shown is vocabulary (the canonical provenance legend), never a claim
 * about a real clinician.
 */

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ProvenanceChipLegend } from '@/design-system/components';
import { EvidenceModelMap } from '@/components/trust/EvidenceModelMap';

export const metadata: Metadata = {
  title: 'The Evidence Network — how career evidence moves',
  description:
    'A transparency view of the VitalCV evidence model: clinician-owned identity, named primary sources with honest availability, source states, consented proof packets, opportunity requirements, and employer head-start Recognition.',
};

interface Concept {
  eyebrow: string;
  title: string;
  body: string;
  boundary: string;
}

const CONCEPTS: ReadonlyArray<Concept> = [
  {
    eyebrow: 'The center',
    title: 'Clinician-owned identity',
    body: 'One NPI anchors the record. The clinician owns it: what is shared, with whom, and for how long is the clinician’s choice, with access history visible.',
    boundary: 'Ownership does not change who decides hiring or privileging.',
  },
  {
    eyebrow: 'Inputs',
    title: 'Primary sources, named honestly',
    body: 'NPPES is read live per request. OIG / LEIE exclusions refresh on a monthly snapshot and CMS PECOS enrollment on a quarterly one — real sources, but not realtime, and labelled that way. State license boards are access-gated — VitalCV does not read them without agreements, and says so rather than implying coverage.',
    boundary: 'A source that was not read is shown as not read — never inferred.',
  },
  {
    eyebrow: 'Artifacts',
    title: 'Consented proof packet',
    body: 'Evidence a clinician chooses to share travels as a sealed, versioned packet: claims, source checks, and their limitations — frozen at the moment of sharing so a review stays replayable.',
    boundary: 'A packet is a head start for review, not a completed decision.',
  },
  {
    eyebrow: 'Demand side',
    title: 'Opportunity requirements',
    body: 'Roles carry their real requirements. Matching explains why an opportunity is shown and which requirements remain unproven — an explanation, never a verdict.',
    boundary: 'Missing information lowers confidence; it is never treated as a rejection.',
  },
  {
    eyebrow: 'Recognition',
    title: 'Employer head start',
    body: 'An employer may accept defined, source-attributed evidence as a head start — recorded, scoped, and replayable — so the clinician does not re-prove what was already accepted.',
    boundary: 'Final credentialing, privileging, and hiring authority remain with the institution.',
  },
];

function Section({ children, tight }: { children: ReactNode; tight?: boolean }) {
  return (
    <section
      style={{
        borderTop: '1px solid var(--vt-border)',
        paddingTop: tight ? 22 : 30,
        marginTop: tight ? 28 : 40,
      }}
    >
      {children}
    </section>
  );
}

export default function EvidenceNetworkPage() {
  return (
    <main
      style={{
        maxWidth: 880,
        margin: '0 auto',
        padding: '56px 24px 96px',
        color: 'var(--vt-text-primary)',
      }}
    >
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
        Trust · how evidence moves
      </p>
      <h1
        style={{
          margin: '0 0 14px',
          fontSize: 36,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          lineHeight: 1.08,
        }}
      >
        The Evidence Network
      </h1>
      <p
        style={{
          fontSize: 15.5,
          lineHeight: 1.65,
          color: 'var(--vt-text-secondary)',
          maxWidth: '62ch',
          margin: 0,
        }}
      >
        The model beneath VitalCV: how a clinician&rsquo;s career evidence is gathered from
        named sources, carried in a clinician-owned record, shared by consent, and
        recognized by employers as a head start.
      </p>

      <div
        data-evidence-model-disclaimer=""
        style={{
          marginTop: 22,
          borderRadius: 12,
          border: '1px solid var(--vt-border)',
          background: 'var(--vt-surface-subtle, transparent)',
          padding: '12px 16px',
          fontSize: 13,
          lineHeight: 1.6,
          color: 'var(--vt-text-secondary)',
        }}
      >
        This page describes VitalCV&rsquo;s <strong style={{ color: 'var(--vt-text-primary)' }}>evidence model</strong>.
        It does not show live clinician relationships, real people, or completed
        credentialing. Views of a real record exist only on signed-in, authorized
        product surfaces.
      </div>

      <EvidenceModelMap />

      {CONCEPTS.map((concept) => (
        <Section key={concept.title}>
          <p
            style={{
              fontFamily: 'var(--vt-font-mono, ui-monospace, monospace)',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              color: 'var(--vt-text-muted, var(--vt-text-secondary))',
              margin: '0 0 8px',
            }}
          >
            {concept.eyebrow}
          </p>
          <h2 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>
            {concept.title}
          </h2>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: 'var(--vt-text-secondary)', maxWidth: '64ch' }}>
            {concept.body}
          </p>
          <p
            style={{
              margin: '10px 0 0',
              fontFamily: 'var(--vt-font-mono, ui-monospace, monospace)',
              fontSize: 11.5,
              lineHeight: 1.6,
              color: 'var(--vt-text-muted, var(--vt-text-secondary))',
              maxWidth: '70ch',
            }}
          >
            Boundary — {concept.boundary}
          </p>
        </Section>
      ))}

      <Section>
        <p
          style={{
            fontFamily: 'var(--vt-font-mono, ui-monospace, monospace)',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            color: 'var(--vt-text-muted, var(--vt-text-secondary))',
            margin: '0 0 8px',
          }}
        >
          Vocabulary
        </p>
        <h2 style={{ margin: '0 0 14px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>
          Every status names its source and time
        </h2>
        <ProvenanceChipLegend heading="The states evidence can be in" />
      </Section>

      <Section tight>
        <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>
          Where the explorable graph went
        </h2>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: 'var(--vt-text-secondary)', maxWidth: '66ch' }}>
          An earlier version of this page showed an interactive network built from
          sample data. Because person-like nodes do not belong on a public page of a
          healthcare trust product &mdash; even as illustrations &mdash; that view was retired.
          Relationship views of real records are signed-in product surfaces, scoped to
          the viewer&rsquo;s own record and role.
        </p>
        <p style={{ margin: '14px 0 0', fontSize: 13.5 }}>
          <Link href="/trust" style={{ color: 'var(--vt-accent, inherit)', textDecoration: 'underline', textUnderlineOffset: 4 }}>
            Trust Center
          </Link>
          <span style={{ color: 'var(--vt-text-muted)' }}> · </span>
          <Link href="/trust/attribution" style={{ color: 'var(--vt-accent, inherit)', textDecoration: 'underline', textUnderlineOffset: 4 }}>
            Source attribution
          </Link>
          <span style={{ color: 'var(--vt-text-muted)' }}> · </span>
          <Link href="/" style={{ color: 'var(--vt-accent, inherit)', textDecoration: 'underline', textUnderlineOffset: 4 }}>
            Check readiness
          </Link>
        </p>
      </Section>
    </main>
  );
}
