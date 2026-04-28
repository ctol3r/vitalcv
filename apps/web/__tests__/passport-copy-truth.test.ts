/**
 * TRUTH-CLEANUP-2 — passport page copy-truth invariants.
 *
 * VitalCV does not ship a wallet protocol (no OID4VP / DIDComm / key
 * management) and does not perform real-time source verification (the
 * source-health classifier is scheduled, not real-time, and is
 * classification telemetry — not credential verification). The
 * passport page must therefore not carry "Wallet entry" framing or a
 * generic "real-time" claim, even in code comments, because comments
 * propagate via grep and shape future contributors' mental models.
 *
 * This suite reads the page source as text and asserts the banned
 * phrases do not appear, and that any retained "wallet"/"real-time"
 * substrings are accounted for by allow-listed exact strings (e.g.
 * the NPI checksum-feedback comment).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGE_PATH = resolve(__dirname, '..', 'app', 'passport', 'page.tsx');

function readPage(): string {
  return readFileSync(PAGE_PATH, 'utf-8');
}

describe('passport page copy truth', () => {
  it('does not contain the bare phrase "Wallet entry"', () => {
    const src = readPage();
    expect(src).not.toMatch(/Wallet entry/);
  });

  it('does not contain the phrase "Real-time visual feedback"', () => {
    const src = readPage();
    expect(src).not.toMatch(/Real-time visual feedback/);
  });

  it('does not claim a wallet is ready or shipped', () => {
    const src = readPage().toLowerCase();
    expect(src).not.toContain('wallet ready');
    expect(src).not.toContain('credential wallet');
    expect(src).not.toContain('self-sovereign wallet');
  });

  it('does not make generic real-time / live-verification claims in user-facing copy', () => {
    const src = readPage().toLowerCase();
    // Bare "real-time" / "real time" must not appear; the source-health
    // probe schedule is every-six-hours, not real-time.
    expect(src).not.toMatch(/\breal-?time\b/);
    expect(src).not.toContain('live verification');
    expect(src).not.toContain('real-time source verification');
  });

  it('does not introduce DID/VC/crypto/biometric/identity-proofing claims', () => {
    const src = readPage();
    const banned = [
      'self-sovereign',
      'cryptographic audit trail',
      'Merkle audit trail',
      'blockchain verified',
      'government ID verified',
      'biometric verified',
      'liveness verified',
      'OID4VP',
      'OID4VCI',
      'SD-JWT',
      'W3C VC',
    ];
    for (const phrase of banned) {
      expect(src).not.toContain(phrase);
    }
  });

  it('does not contain blanket truth-contract banned phrases', () => {
    const src = readPage().toLowerCase();
    const banned = [
      'guaranteed verification',
      'instant credentialing',
      'complete credentialing',
      'legally accepted',
      'risk transferred',
      'hipaa compliant',
      'soc2 certified',
      'ncqa verified',
      'irreversible proof',
      'tamper-proof',
    ];
    for (const phrase of banned) {
      expect(src).not.toContain(phrase);
    }
  });
});
