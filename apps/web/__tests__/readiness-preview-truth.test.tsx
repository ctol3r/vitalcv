import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReadinessPreview } from '../components/hero/ReadinessPreview';

vi.mock('@/components/trust/EvidenceDisclosureCard', () => ({
  EvidenceDisclosureCard: ({
    title,
    description,
    children,
  }: {
    title: string;
    description: string;
    children: React.ReactNode;
  }) => (
    <section>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </section>
  ),
}));

vi.mock('@/components/trust/ProofDetailsList', () => ({
  ProofDetailsList: ({
    rows,
  }: {
    rows: Array<{ id: string; label: string; value: React.ReactNode }>;
  }) => (
    <dl>
      {rows.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  ),
}));

describe('ReadinessPreview truth gating', () => {
  it('keeps live readiness provisional when the stream has zero source-backed claims', () => {
    const markup = renderToStaticMarkup(
      <ReadinessPreview
        npi="1234567890"
        realState={null}
        isDemo={false}
        visible
        onContinue={vi.fn()}
        streamState={{
          phase: 'done',
          npi: '1234567890',
          identity: {
            displayName: 'Macie Miller',
            specialty: 'Primary Care Nurse Practitioner',
            authoritative: true,
            status: 'ACTIVE',
          },
          standing: {
            exclusionChecked: false,
            enrollmentChecked: false,
          },
          readiness: {
            score: 55,
            level: 'L1',
            status: 'PARTIAL',
            claimCount: 0,
            blockerCount: 0,
            checkedAt: '2026-04-09T12:00:00.000Z',
          },
          sources: {
            nppes: 'done',
            oig: 'pending',
            pecos: 'pending',
          },
          events: [],
          isUsable: false,
          disconnected: false,
          completedAt: '2026-04-09T12:00:00.000Z',
        }}
      />,
    );

    expect(markup).toContain('Claims: 0');
    expect(markup).toContain('Waiting for blocker and readiness detail from the live source run.');
    expect(markup).not.toContain('55/100');
  });
});
