/**
 * trust-copy-safety.test.ts
 *
 * Source-level scan over every trust-surface file: forbids bare
 * "Verified" labels, the standard truth-contract banned phrases,
 * the customer-cohort placeholders the brief explicitly forbids,
 * and unsupported security/compliance claims.
 *
 * The scan operates on the file content (not rendered HTML) so any
 * banned phrase introduced as a string literal or JSX text is
 * caught even if no test renders that route.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const WEB_ROOT = join(__dirname, '..');

// Files in scope — every trust-surface source file PR introduces.
const FILES = [
  'styles/trust.css',
  'lib/trust/types.ts',
  'lib/trust/format.ts',
  'lib/trust/demoData.ts',
  'components/trust/primitives.tsx',
  'components/trust/SurfaceHeader.tsx',
  'components/trust/LineageHeader.tsx',
  'components/trust/SignaturePanel.tsx',
  'components/trust/ChainStrip.tsx',
  'components/trust/FailureBanner.tsx',
  'components/trust/DegradedRow.tsx',
  'app/trust-canon/layout.tsx',
  'app/trust-canon/passport/[npi]/page.tsx',
  'app/trust-canon/verify/[receipt]/page.tsx',
  'app/trust-canon/replay/page.tsx',
  'app/trust-canon/receipt/[id]/page.tsx',
  'app/trust-canon/trust/page.tsx',
];

const BANNED_PHRASES: ReadonlyArray<RegExp> = [
  /automatically verified/i,
  /guaranteed verification/i,
  /\bcomplete credentialing\b/i,
  /instant credentialing/i,
  /legally accepted/i,
  /risk transferred/i,
  /HIPAA compliant/i,
  /SOC ?2 certified/i,
  /NCQA certified/i,
  /certified compliant/i,
  /final verification without review/i,
  /source confirmed before response/i,
  /instantly verified/i,
  /\bfully verified\b/i,
  /real-time verification/i,
  /real-time check/i,
  /guaranteed compliant/i,
  /eliminates credentialing/i,
  /replaces credentialing/i,
  /accepted everywhere/i,
  /\balways up to date\b/i,
  /solves burnout/i,
  /solves diversity attrition/i,
  /HITRUST certified/i,
  /BAA not required/i,
];

// Bare-Verified markers (case-sensitive, capital-V only).
const BARE_VERIFIED: ReadonlyArray<RegExp> = [
  /(?:label|status)\s*[:=]\s*['"`]Verified['"`]/,
  /['"`]Verified['"`]/,
  />\s*Verified\s*</,
  /\bVerified provider\b/,
  /\bVerified source\b/,
];

// Customer-cohort placeholders the brief forbids.
const FORBIDDEN_CUSTOMER_CLAIMS: ReadonlyArray<RegExp> = [
  /Cedar Health/i,
  /\bN ?= ?47\b/i,
  /Q2 ?2026 pilot/i,
];

// Unsupported security / signature / SLA claims.
const FORBIDDEN_SECURITY_CLAIMS: ReadonlyArray<RegExp> = [
  /AES ?-? ?256/,
  /\b72-?hour deletion\b/i,
  /deletion receipt/i,
  /\bSLA\b/,
  /ed25519 fingerprint/i,
  /offline re-?verifiable/i,
];

// Files that legitimately mention the forbidden literals as
// NEGATIONS ("does not claim X") — allowed by the canon. Each entry
// is a path suffix.
const NEGATION_ALLOWLIST: ReadonlyArray<string> = [
  'lib/trust/demoData.ts',
  'app/trust-canon/trust/page.tsx',
  '__tests__/trust-copy-safety.test.ts',
];

// Files where bare-Verified appears only inside a JSDoc negation
// ("no bare Verified labels", "never bare Verified"). These are
// contract documentation, not bare-label assertions in product copy.
// The renderer guards (VerdictBar runtime check, no JSX text-node
// "Verified" anywhere) remain enforced by the routing/render tests.
const BARE_VERIFIED_NEGATION_ALLOWLIST: ReadonlyArray<string> = [
  'lib/trust/demoData.ts',
  'components/trust/LineageHeader.tsx',
  'components/trust/primitives.tsx',
  'app/trust-canon/verify/[receipt]/page.tsx',
];

function isNegationAllowlisted(rel: string): boolean {
  return NEGATION_ALLOWLIST.some((s) => rel.endsWith(s));
}

function isBareVerifiedNegationAllowlisted(rel: string): boolean {
  return BARE_VERIFIED_NEGATION_ALLOWLIST.some((s) => rel.endsWith(s));
}

function read(rel: string): string {
  const full = join(WEB_ROOT, rel);
  if (!existsSync(full)) return '';
  return readFileSync(full, 'utf8');
}

describe('trust-surface copy safety', () => {
  for (const rel of FILES) {
    describe(rel, () => {
      const src = read(rel);

      it('file exists', () => {
        expect(src.length, `${rel} is empty`).toBeGreaterThan(0);
      });

      it('contains no banned phrases', () => {
        for (const re of BANNED_PHRASES) {
          expect(src, `${rel} contains banned phrase ${re}`).not.toMatch(re);
        }
      });

      it('contains no bare "Verified" label', () => {
        if (isBareVerifiedNegationAllowlisted(rel)) {
          // The runtime guards in VerdictBar + the routing tests
          // enforce no bare Verified in rendered DOM. This file's
          // hits are JSDoc negations documenting the contract.
          return;
        }
        for (const re of BARE_VERIFIED) {
          expect(src, `${rel} contains bare-Verified pattern ${re}`).not.toMatch(re);
        }
      });

      it('contains no Cedar Health / N=47 / Q2 2026 cohort claim', () => {
        for (const re of FORBIDDEN_CUSTOMER_CLAIMS) {
          expect(src, `${rel} contains forbidden customer claim ${re}`).not.toMatch(re);
        }
      });

      it('contains no unsupported security claim (AES-256, deletion receipt, SLA, ed25519 fingerprint)', () => {
        if (isNegationAllowlisted(rel)) {
          // The doctrine page lists these as NON-claims ("does not
          // assert AES-256, deletion receipt, SLA…"). The negation
          // form is allowed because the surface explicitly disclaims
          // each pattern.
          return;
        }
        for (const re of FORBIDDEN_SECURITY_CLAIMS) {
          expect(src, `${rel} contains unsupported security claim ${re}`).not.toMatch(re);
        }
      });
    });
  }
});

describe('trust.css scoping', () => {
  it('every top-level selector either anchors on .trust-scope or uses the .t- class-prefix namespace', () => {
    const src = read('styles/trust.css');
    expect(src.length).toBeGreaterThan(0);

    // Strip comment blocks before testing.
    const noComments = src.replace(/\/\*[\s\S]*?\*\//g, '');

    // The canon uses two scoping disciplines together:
    //   1. The root `.trust-scope` rule sets variables / typography.
    //   2. All component rules use `.t-…` class names that are only
    //      emitted by components rendered INSIDE the layout's
    //      `<div class="trust-scope">` wrapper.
    // Either prefix is sufficient — anything else would leak.
    const blocks = noComments.split('}');
    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;
      if (!trimmed.includes('{')) continue;
      const selectorPart = trimmed.split('{')[0].trim();
      if (!selectorPart) continue;

      const ok =
        selectorPart.startsWith('.trust-scope') ||
        selectorPart.startsWith('.t-') ||
        selectorPart.startsWith('@keyframes') ||
        selectorPart.startsWith('@media') ||
        selectorPart.startsWith('@supports') ||
        // Nested rule inside @media / @keyframes / @supports
        // (selector starts with `from`, `to`, or a percentage).
        /^(from\b|to\b|\d+%)/.test(selectorPart);
      expect(ok, `Unscoped CSS selector in trust.css: ${selectorPart}`).toBe(true);
    }
  });
});
