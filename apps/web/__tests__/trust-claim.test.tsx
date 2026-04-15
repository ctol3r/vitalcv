/**
 * TrustClaim — rendering + validation contract tests.
 *
 * Purpose
 * -------
 * Lock in the canonical rendering guarantees established by `components/trust-state/TrustClaim.tsx`:
 *
 *   1. Valid `kind` values render the canonical icon + label.
 *   2. Arbitrary string injection — through `any`, typeguard holes, or API payloads —
 *      coerces to `unavailable` + "Unknown". It MUST NOT render as `verified`.
 *   3. Source + timestamp metadata render when supplied.
 *   4. `isTrustClaimKind` rejects everything that is not a recognized kind,
 *      including the adversarial strings from the false-positive guard mission
 *      ("no cryptography", "not cryptographically verified").
 *
 * The canonical vocabulary is intentionally small (verified / pending / gated /
 * unavailable) and lives inside `TrustClaim`; this test file pins that contract.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TrustClaim, isTrustClaimKind, type TrustClaimKind } from '@/components/trust-state/TrustClaim';

describe('TrustClaim', () => {
  describe('renders canonical vocabulary for each valid kind', () => {
    const cases: Array<{ kind: TrustClaimKind; label: string }> = [
      { kind: 'verified', label: 'Verified' },
      { kind: 'pending', label: 'Pending' },
      { kind: 'gated', label: 'Access required' },
      { kind: 'unavailable', label: 'Unavailable' },
    ];

    for (const { kind, label } of cases) {
      it(`renders ${kind} as "${label}"`, () => {
        const markup = renderToStaticMarkup(<TrustClaim kind={kind} />);
        expect(markup).toContain(label);
        expect(markup).toContain(`data-trust-claim-kind="${kind}"`);
      });
    }
  });

  describe('runtime coercion for invalid kinds', () => {
    // Simulate values that slipped past TypeScript via `any`, `as`, or API data.
    // An adversary injecting these MUST see the surface degrade to Unknown,
    // NOT have their string rendered verbatim and NOT be treated as verified.
    const adversarialValues: ReadonlyArray<unknown> = [
      'cryptographically verified',
      'verified via blockchain',
      'no cryptography',
      'not cryptographically verified',
      'Verified', // wrong case — vocabulary is lowercase
      'VERIFIED',
      'checked',  // not in the TrustClaim vocab; only a TrustStatusBadge status
      'approved',
      'TRUSTED',
      '',
      'null',
      undefined,
      null,
      42,
      {},
      [],
    ];

    for (const value of adversarialValues) {
      const display = typeof value === 'string' ? `"${value}"` : String(value);

      it(`coerces ${display} to Unknown + unavailable`, () => {
        // Deliberately cast through `any` to exercise the runtime path,
        // mirroring how bad data could arrive from an API payload.
        const markup = renderToStaticMarkup(
          <TrustClaim kind={value as unknown as TrustClaimKind} />,
        );

        expect(markup).toContain('Unknown');
        expect(markup).toContain('data-trust-claim-kind="unavailable"');
        expect(markup).not.toContain('Verified');
        // Guard against verbatim reflection — the adversarial text must never surface.
        if (typeof value === 'string' && value.length > 0 && value !== 'Verified' && value !== 'VERIFIED') {
          expect(markup).not.toContain(value);
        }
      });
    }
  });

  describe('isTrustClaimKind typeguard', () => {
    it('accepts every canonical kind', () => {
      expect(isTrustClaimKind('verified')).toBe(true);
      expect(isTrustClaimKind('pending')).toBe(true);
      expect(isTrustClaimKind('gated')).toBe(true);
      expect(isTrustClaimKind('unavailable')).toBe(true);
    });

    it('rejects adversarial crypto-adjacent phrasings', () => {
      expect(isTrustClaimKind('cryptographically verified')).toBe(false);
      expect(isTrustClaimKind('no cryptography')).toBe(false);
      expect(isTrustClaimKind('not cryptographically verified')).toBe(false);
      expect(isTrustClaimKind('zero-knowledge proof')).toBe(false);
      expect(isTrustClaimKind('blockchain anchored')).toBe(false);
    });

    it('rejects non-string values', () => {
      expect(isTrustClaimKind(undefined)).toBe(false);
      expect(isTrustClaimKind(null)).toBe(false);
      expect(isTrustClaimKind(0)).toBe(false);
      expect(isTrustClaimKind({ kind: 'verified' })).toBe(false);
    });

    it('is case-sensitive (the vocabulary is lowercase)', () => {
      expect(isTrustClaimKind('Verified')).toBe(false);
      expect(isTrustClaimKind('VERIFIED')).toBe(false);
    });
  });

  describe('optional metadata rendering', () => {
    it('renders the source when supplied', () => {
      const markup = renderToStaticMarkup(
        <TrustClaim kind="verified" source="NPPES" />,
      );
      expect(markup).toContain('NPPES');
    });

    it('renders a formatted timestamp when supplied', () => {
      const markup = renderToStaticMarkup(
        <TrustClaim kind="verified" timestamp="2026-03-02T12:00:00Z" />,
      );
      // Locale-dependent month abbreviation; check for the year which is locale-stable.
      expect(markup).toContain('2026');
      expect(markup).toContain('<time');
    });

    it('silently omits a malformed timestamp rather than rendering a raw string', () => {
      const markup = renderToStaticMarkup(
        <TrustClaim kind="verified" timestamp="not-a-date" />,
      );
      expect(markup).not.toContain('not-a-date');
    });

    it('composes source + timestamp with a separator when both are supplied', () => {
      const markup = renderToStaticMarkup(
        <TrustClaim kind="verified" source="OIG / LEIE" timestamp="2026-02-15" />,
      );
      expect(markup).toContain('OIG / LEIE');
      expect(markup).toContain('2026');
    });

    it('renders the limitation when supplied', () => {
      const markup = renderToStaticMarkup(
        <TrustClaim
          kind="gated"
          source="State board"
          limitation="Institutional access required"
        />,
      );
      expect(markup).toContain('Institutional access required');
      expect(markup).toContain('data-trust-claim-limitation');
    });

    it('ignores whitespace-only limitation strings', () => {
      const markup = renderToStaticMarkup(
        <TrustClaim kind="verified" limitation="   " />,
      );
      expect(markup).not.toContain('data-trust-claim-limitation');
    });

    it('includes the limitation in the aria-label for screen readers', () => {
      const markup = renderToStaticMarkup(
        <TrustClaim
          kind="gated"
          source="State board"
          limitation="Not decision-grade without L3"
        />,
      );
      expect(markup).toContain('limitation: Not decision-grade without L3');
    });
  });

  describe('compile-time enforcement', () => {
    it('rejects invalid literals at compile time', () => {
      // @ts-expect-error — 'cryptographically verified' is not a TrustClaimKind.
      void (<TrustClaim kind="cryptographically verified" />);
      // @ts-expect-error — 'approved' is not a TrustClaimKind.
      void (<TrustClaim kind="approved" />);
      // @ts-expect-error — numbers are not TrustClaimKinds.
      void (<TrustClaim kind={1} />);
    });
  });
});
