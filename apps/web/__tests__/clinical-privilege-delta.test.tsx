/**
 * ClinicalPrivilegeDelta — rendering contract tests.
 *
 * Locks in the privilege table's core guarantees:
 *   1. Each privilege row renders label, required proof, matched evidence,
 *      and a status chip drawn from the canonical trust vocabulary.
 *   2. 'missing' evidence surfaces as "Not on file" — never a cheerful default.
 *   3. Peer-reference CTA renders for missing/partial rows; renders as
 *      "Requested" (disabled) for peer_requested rows; omitted otherwise.
 *   4. tabular-nums is applied to the case count cell (design enforcement).
 *   5. met / gap counters in the header reflect the status roll-up.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ClinicalPrivilegeDelta } from '@/components/employer/ClinicalPrivilegeDelta';
import type { ClinicalPrivilegeRequest } from '@/lib/clinical/privilege-types';

const basePrivileges: ClinicalPrivilegeRequest[] = [
  {
    id: 'moderate_sedation',
    label: 'Moderate Sedation',
    context: 'Procedural',
    requiredProof: 'Certification current + 25 cases in last 12 months',
    matchedEvidence: '31 cases · certification current',
    status: 'met',
    caseCount: 31,
    caseCountRequired: 25,
    window: '12 mo',
  },
  {
    id: 'central_line_placement',
    label: 'Central Venous Catheter Insertion',
    context: 'Inpatient',
    requiredProof: 'Case logs: 10 in last 24 months',
    matchedEvidence: '7 cases on file',
    status: 'partial',
    caseCount: 7,
    caseCountRequired: 10,
    window: '24 mo',
  },
  {
    id: 'first_assist_surgery',
    label: 'First Assist in Surgery',
    context: 'Operating suite',
    requiredProof: 'Case logs: 25 in last 24 months',
    status: 'missing',
    caseCount: 0,
    caseCountRequired: 25,
    window: '24 mo',
  },
  {
    id: 'regional_anesthesia',
    label: 'Regional Anesthesia · Peripheral Nerve Block',
    context: 'Orthopaedic adjunct',
    requiredProof: 'Case logs: 20 in last 24 months',
    matchedEvidence: '14 cases · peer attestation pending',
    status: 'peer_requested',
    caseCount: 14,
    caseCountRequired: 20,
    window: '24 mo',
  },
];

describe('ClinicalPrivilegeDelta', () => {
  it('renders each privilege row with label, required proof, and matched evidence', () => {
    const markup = renderToStaticMarkup(
      <ClinicalPrivilegeDelta privileges={basePrivileges} />,
    );
    expect(markup).toContain('Moderate Sedation');
    expect(markup).toContain('Certification current + 25 cases in last 12 months');
    expect(markup).toContain('31 cases · certification current');
    expect(markup).toContain('Central Venous Catheter Insertion');
    expect(markup).toContain('First Assist in Surgery');
  });

  it('surfaces "Not on file" for privileges with no matched evidence', () => {
    const markup = renderToStaticMarkup(
      <ClinicalPrivilegeDelta privileges={basePrivileges} />,
    );
    expect(markup).toContain('Not on file');
  });

  it('renders peer-reference CTA for missing and partial rows', () => {
    const markup = renderToStaticMarkup(
      <ClinicalPrivilegeDelta privileges={basePrivileges} />,
    );
    expect(markup).toContain('data-privilege-peer-cta="first_assist_surgery"');
    expect(markup).toContain('data-privilege-peer-cta="central_line_placement"');
    expect(markup).toContain('Peer reference');
  });

  it('renders a "Requested" chip (disabled) for peer_requested rows', () => {
    const markup = renderToStaticMarkup(
      <ClinicalPrivilegeDelta privileges={basePrivileges} />,
    );
    expect(markup).toContain('data-privilege-peer-cta="regional_anesthesia"');
    expect(markup).toContain('Requested');
  });

  it('omits CTA entirely for met rows', () => {
    const metOnly = basePrivileges.filter((p) => p.status === 'met');
    const markup = renderToStaticMarkup(
      <ClinicalPrivilegeDelta privileges={metOnly} />,
    );
    expect(markup).not.toContain('data-privilege-peer-cta');
  });

  it('applies tabular-nums to case counts (design enforcement)', () => {
    const markup = renderToStaticMarkup(
      <ClinicalPrivilegeDelta privileges={basePrivileges} />,
    );
    expect(markup).toContain('tabular-nums');
  });

  it('met / gap rollup reflects status counts', () => {
    const markup = renderToStaticMarkup(
      <ClinicalPrivilegeDelta privileges={basePrivileges} />,
    );
    // 1 met, 3 gap (partial + missing + peer_requested)
    expect(markup).toMatch(/>1</);
    expect(markup).toContain('met');
    expect(markup).toMatch(/>3</);
    expect(markup).toContain('gaps');
  });

  it('renders an empty state when no privileges are attached', () => {
    const markup = renderToStaticMarkup(<ClinicalPrivilegeDelta privileges={[]} />);
    expect(markup).toContain('No privilege requests attached');
  });

  it('disables peer-reference CTA when peerReferenceDisabled is true', () => {
    const markup = renderToStaticMarkup(
      <ClinicalPrivilegeDelta
        privileges={basePrivileges}
        peerReferenceDisabled
        peerReferenceDisabledReason="Sign in to request peer references"
      />,
    );
    expect(markup).toContain('disabled');
    expect(markup).toContain('Sign in to request peer references');
  });
});
