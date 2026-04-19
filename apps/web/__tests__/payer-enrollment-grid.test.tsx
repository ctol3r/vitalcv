/**
 * PayerEnrollmentGrid — rendering contract tests.
 *
 * Guarantees pinned:
 *   1. Every lane renders a chip with its label and status vocabulary drawn
 *      from the canonical PayerEnrollmentStatus map.
 *   2. Verified / processing / awaiting / action-required / unchecked all
 *      emit distinct `data-payer-status` attributes for downstream probes.
 *   3. The "verified / total" counter reflects the status roll-up.
 *   4. An unknown status falls back to 'unchecked' rather than throwing.
 *   5. tabular-nums is applied to observed-at timestamps.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PayerEnrollmentGrid } from '@/components/employer/PayerEnrollmentGrid';
import type { PayerEnrollmentLane } from '@/lib/clinical/privilege-types';

const lanes: PayerEnrollmentLane[] = [
  {
    id: 'medicare_pecos',
    label: 'Medicare (PECOS)',
    category: 'government',
    status: 'verified',
    note: 'Quarterly · confirmed',
    observedAt: '2026-01-15T00:00:00.000Z',
  },
  {
    id: 'bcbs',
    label: 'Blue Cross Blue Shield',
    category: 'commercial',
    status: 'processing',
    note: 'Submitted · 11 days ago',
  },
  {
    id: 'aetna',
    label: 'Aetna',
    category: 'commercial',
    status: 'awaiting_npi',
    note: 'Waiting on group NPI link',
  },
  {
    id: 'humana',
    label: 'Humana',
    category: 'commercial',
    status: 'action_required',
    note: 'Payer returned a roster mismatch',
  },
  {
    id: 'uhc',
    label: 'UnitedHealthcare',
    category: 'commercial',
    status: 'unchecked',
  },
];

describe('PayerEnrollmentGrid', () => {
  it('renders a chip for every payer with label and status vocabulary', () => {
    const markup = renderToStaticMarkup(<PayerEnrollmentGrid payers={lanes} />);
    expect(markup).toContain('Medicare (PECOS)');
    expect(markup).toContain('Verified');
    expect(markup).toContain('Blue Cross Blue Shield');
    expect(markup).toContain('Processing');
    expect(markup).toContain('Aetna');
    expect(markup).toContain('Awaiting NPI link');
    expect(markup).toContain('Humana');
    expect(markup).toContain('Action required');
    expect(markup).toContain('UnitedHealthcare');
    expect(markup).toContain('Unchecked');
  });

  it('emits distinct data-payer-status attributes per lane', () => {
    const markup = renderToStaticMarkup(<PayerEnrollmentGrid payers={lanes} />);
    expect(markup).toContain('data-payer-status="verified"');
    expect(markup).toContain('data-payer-status="processing"');
    expect(markup).toContain('data-payer-status="awaiting_npi"');
    expect(markup).toContain('data-payer-status="action_required"');
    expect(markup).toContain('data-payer-status="unchecked"');
  });

  it('renders verified-count rollup', () => {
    const markup = renderToStaticMarkup(<PayerEnrollmentGrid payers={lanes} />);
    // 1 verified out of 5 total
    expect(markup).toMatch(/>1</);
    expect(markup).toMatch(/>5</);
    expect(markup).toContain('verified');
  });

  it('falls back to unchecked when status is unknown (type-escape)', () => {
    const escaped = [
      {
        id: 'mystery_payer',
        label: 'Mystery Payer',
        status: 'nonsense' as unknown as 'verified',
      } satisfies PayerEnrollmentLane,
    ];
    const markup = renderToStaticMarkup(<PayerEnrollmentGrid payers={escaped} />);
    expect(markup).toContain('Unchecked');
  });

  it('applies tabular-nums to observed-at timestamps', () => {
    const markup = renderToStaticMarkup(<PayerEnrollmentGrid payers={lanes} />);
    expect(markup).toContain('tabular-nums');
  });

  it('renders an empty state when no lanes are passed', () => {
    const markup = renderToStaticMarkup(<PayerEnrollmentGrid payers={[]} />);
    expect(markup).toContain('No payer lanes');
  });
});
