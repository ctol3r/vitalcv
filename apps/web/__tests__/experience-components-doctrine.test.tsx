import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ApplicationEvidenceTimeline } from '@/design-system/components/ApplicationEvidenceTimeline';
import { ConsentSeal } from '@/design-system/components/ConsentSeal';
import { EnterpriseWorkflowCloseup } from '@/design-system/components/EnterpriseWorkflowCloseup';
import { EvidenceInspector } from '@/design-system/components/EvidenceInspector';
import { ExpandingEyebrow } from '@/design-system/components/ExpandingEyebrow';
import { HumanReviewCheckpoint } from '@/design-system/components/HumanReviewCheckpoint';
import { PacketHandoff } from '@/design-system/components/PacketHandoff';
import { ProductAction } from '@/design-system/components/ProductAction';
import { SourceWorkflowTabs } from '@/design-system/components/SourceWorkflowTabs';

/**
 * Doctrine conformance for the experience component set.
 *
 * These assert the RULING, not the mechanism — a better implementation of the
 * same clause must not turn this suite red. That is why nothing here asserts a
 * class name, a hex value or a DOM shape: it asserts that a pill is absent, that
 * a state word is legible without colour, that a source and an age are present,
 * that a tablist has tabs.
 */

const inspector = (
  <EvidenceInspector
    title="Medicare enrollment"
    recordId="1234567893"
    facts={[
      {
        label: 'Enrollment',
        value: 'Approved · PECOS',
        source: 'CMS PECOS',
        asOf: '2026-07-01 quarterly snapshot',
        note: 'Quarterly snapshot. True as of the date shown, not as of now.',
      },
    ]}
    doesNotDecide="Whether this clinician may treat patients at your facility."
  />
);

describe('experience components — CD conformance', () => {
  it('CD-10: no component renders a pill', () => {
    const markup = [
      renderToStaticMarkup(inspector),
      renderToStaticMarkup(<ExpandingEyebrow detail="detail">Sources read</ExpandingEyebrow>),
      renderToStaticMarkup(<ProductAction>Check readiness</ProductAction>),
      renderToStaticMarkup(
        <SourceWorkflowTabs label="Sources" tabs={[{ id: 'a', label: 'NPPES', panel: inspector }]} />,
      ),
      renderToStaticMarkup(
        <ConsentSeal
          grantedTo="Tampa General"
          scope={['Identity', 'Exclusions']}
          grantedAt="2026-08-01"
          expiresAt={null}
          revocationRoute="Withdraw any time from your record."
        />,
      ),
      renderToStaticMarkup(
        <PacketHandoff
          recipient="Tampa General"
          steps={[{ label: 'Issued', actor: 'NPPES', at: '2026-08-01' }]}
          doesNotDecide="Credentialing."
        />,
      ),
      renderToStaticMarkup(
        <HumanReviewCheckpoint
          state="awaiting"
          awaitingWhom="Credentialing team"
          decision="Whether the licence limitation is material."
          asOf="2026-08-01"
        />,
      ),
    ].join('');

    // CD-10 retires the pill outright: "999px → Nothing."
    expect(markup).not.toContain('rounded-full');
    expect(markup).not.toContain('9999px');
    expect(markup).not.toContain('--vt-radius-pill');
  });

  it('CD-2.2 / CD-16.3: an asserted fact always renders its source and its age', () => {
    const markup = renderToStaticMarkup(inspector);
    expect(markup).toContain('CMS PECOS');
    expect(markup).toContain('2026-07-01 quarterly snapshot');
    // And the artifact states its limit rather than implying none.
    expect(markup).toContain('Does not decide');
  });

  it('CD-5: the state word is legible with colour removed', () => {
    const markup = renderToStaticMarkup(
      <HumanReviewCheckpoint
        state="awaiting"
        awaitingWhom="Credentialing team"
        decision="Whether the licence limitation is material."
        asOf="2026-08-01"
      />,
    );
    // The WORD is present as text, so grayscale costs nothing. The hue is only
    // ever on the glyph and the left rule.
    expect(markup).toContain('Awaiting review');
    expect(markup).toContain('Credentialing team');
    // And the surface never implies the machine decided.
    expect(markup).toContain('A person makes this decision');
  });

  it('CD-15: tabs ship real ARIA — the defect measured on two reference sites', () => {
    const markup = renderToStaticMarkup(
      <SourceWorkflowTabs
        label="Sources"
        tabs={[
          { id: 'nppes', label: 'NPPES', panel: inspector },
          { id: 'oig', label: 'OIG', panel: inspector },
        ]}
      />,
    );
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('role="tab"');
    expect(markup).toContain('role="tabpanel"');
    expect(markup).toContain('aria-selected');
    expect(markup).toContain('aria-controls');
  });

  it('CD-1: an illustrative artifact says so by default', () => {
    const markup = renderToStaticMarkup(
      <EnterpriseWorkflowCloseup caption="A real source result.">{inspector}</EnterpriseWorkflowCloseup>,
    );
    expect(markup).toContain('Illustrative — not a live result');

    const live = renderToStaticMarkup(
      <EnterpriseWorkflowCloseup caption="Live." illustrative={false}>
        {inspector}
      </EnterpriseWorkflowCloseup>,
    );
    expect(live).not.toContain('Illustrative');
  });

  it('CD-1: an absent expiry is stated, never left blank', () => {
    const markup = renderToStaticMarkup(
      <ConsentSeal
        grantedTo="Tampa General"
        scope={['Identity']}
        grantedAt="2026-08-01"
        expiresAt={null}
        revocationRoute="Withdraw any time."
      />,
    );
    expect(markup).toContain('Does not expire');
  });

  it('R1 / CD-13: the handoff is an ordered sequence, not a node-link graph', () => {
    const markup = renderToStaticMarkup(
      <PacketHandoff
        recipient="Tampa General"
        steps={[
          { label: 'Issued', actor: 'NPPES', at: '2026-08-01' },
          { label: 'Held', actor: 'Clinician', at: '2026-08-01' },
          { label: 'Presented', actor: 'Tampa General', at: null },
        ]}
        doesNotDecide="Credentialing."
      />,
    );
    expect(markup).toContain('<ol');
    expect(markup).not.toMatch(/constellation|forceGraph|lineTo|moveTo/i);
    // A step that has not happened says so, rather than rendering empty.
    expect(markup).toContain('not yet');
  });

  it('CD-2.3: the eyebrow detail stays in the DOM when collapsed', () => {
    // Motion and hover are enrichment; meaning may never depend on them. The
    // detail must be present for no-JS, reduced-motion and screen readers.
    const markup = renderToStaticMarkup(
      <ExpandingEyebrow detail="Read live from NPPES on each request.">Sources</ExpandingEyebrow>,
    );
    expect(markup).toContain('Read live from NPPES on each request.');
    expect(markup).toContain('aria-expanded');
  });

  it('CD-11: no component ships idle motion', () => {
    const markup = [
      renderToStaticMarkup(<ProductAction pending>Check</ProductAction>),
      renderToStaticMarkup(<ExpandingEyebrow detail="d">E</ExpandingEyebrow>),
      renderToStaticMarkup(inspector),
    ].join('');
    // "Nothing idles" — no spinner, pulse, shimmer, bounce or ping.
    expect(markup).not.toMatch(/animate-(spin|pulse|bounce|ping)/);
    // A pending action changes the WORD and marks itself busy instead.
    expect(markup).toContain('aria-busy');
  });

  it('CD-14: the evidence artifact carries no elevation theatre', () => {
    const markup = renderToStaticMarkup(inspector);
    expect(markup).not.toMatch(/shadow-|backdrop-blur|bg-gradient/);
  });

  it('truth contract: no banned status language', () => {
    const markup = [
      renderToStaticMarkup(inspector),
      renderToStaticMarkup(
        <HumanReviewCheckpoint
          state="decided"
          awaitingWhom="Credentialing team"
          decision="Done."
          asOf="2026-08-01"
        />,
      ),
    ].join('');
    // No bare "Verified" as a status, and none of the banned claim phrases.
    expect(markup).not.toMatch(/>Verified</);
    expect(markup.toLowerCase()).not.toContain('automatically verified');
    expect(markup.toLowerCase()).not.toContain('guaranteed verification');
    expect(markup.toLowerCase()).not.toContain('hipaa compliant');
    // And none of the buyer-banned identity vocabulary.
    expect(markup.toLowerCase()).not.toContain('wallet');
    expect(markup.toLowerCase()).not.toContain('blockchain');
  });

  it('renders the timeline as an ordered list with an age on every entry', () => {
    const markup = renderToStaticMarkup(
      <ApplicationEvidenceTimeline
        label="Evidence history"
        entries={[
          { event: 'Identity resolved', actor: 'NPPES', at: '2026-08-01 14:02', source: 'NPPES' },
          { event: 'Packet shared', actor: 'Clinician', at: '2026-08-01 14:06' },
        ]}
      />,
    );
    expect(markup).toContain('<ol');
    expect(markup).toContain('2026-08-01 14:02');
    expect(markup).toContain('2026-08-01 14:06');
  });
});
