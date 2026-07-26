/**
 * Wave 800 — Professional Trust Exchange integration (C6)
 * ──────────────────────────────────────────────────────────────────────────
 * End-to-end chain: Issuer → Evidence → Trust → Professional → Organization →
 * Verifier. Asserts the load-bearing honesty rule: trust is RE-DERIVED by the
 * verifier from exchanged evidence, never transferred or inflated.
 */
import { describe, expect, it } from 'vitest';
import { buildDemoPassport } from '../lib/demo/demo-passport';
import { passportToEvidenceCollection } from '../lib/evidence/passport-to-evidence';
import { projectEvidenceToGraph, propagateTrust } from '@vitalcv/domain-evidence';
import {
  buildEvidenceExchange,
  verifyExchangeSignature,
  evaluateExchange,
  EVIDENCE_EXCHANGE_SCHEMA,
  EXCHANGE_VERDICT_SCHEMA,
} from '../lib/exchange/exchange';
import { authorizeIssuer, memberCanActAs } from '../lib/exchange/federation';
import { demoFederation } from '../lib/exchange/config';

const SECRET = 'test-federation-secret';
const ISSUED_AT = '2026-06-20T12:00:00.000Z';

function issuerCollection() {
  // Issuer → Evidence: source-backed passport projected to an EvidenceCollection.
  return passportToEvidenceCollection(buildDemoPassport());
}

describe('Trust Exchange — full chain (C6)', () => {
  it('Issuer packages a signed exchange that a Verifier accepts and re-derives trust from', () => {
    const collection = issuerCollection();

    // Organization layer: issuer must be an authorized federation member.
    const auth = authorizeIssuer(demoFederation(), 'org-mercy-health');
    expect(auth.authorized).toBe(true);
    expect(memberCanActAs(demoFederation(), 'org-coastal-staffing', 'verifier')).toBe(true);

    // Issuer side: sign the evidence into a portable envelope.
    const exchange = buildEvidenceExchange({ issuer: 'org-mercy-health', collection, secret: SECRET, issuedAt: ISSUED_AT });
    expect(exchange.schema).toBe(EVIDENCE_EXCHANGE_SCHEMA);
    expect(exchange.signature.startsWith('sha256=')).toBe(true);
    expect(exchange.subjectKey).toBe(collection.subjectKey);

    // Verifier side: integrity holds, trust + readiness are re-derived.
    const verdict = evaluateExchange(exchange, SECRET);
    expect(verdict.schema).toBe(EXCHANGE_VERDICT_SCHEMA);
    expect(verdict.signatureValid).toBe(true);
    expect(verdict.trustTransferred).toBe(false);
    expect(verdict.trust).not.toBeNull();
    expect(verdict.readiness).not.toBeNull();
  });

  it('re-derived trust EQUALS the issuer-side trust — moved, not inflated', () => {
    const collection = issuerCollection();
    // What the issuer would see locally.
    const issuerTrust = propagateTrust(projectEvidenceToGraph(collection));

    const exchange = buildEvidenceExchange({ issuer: 'org-vitalcv-network', collection, secret: SECRET, issuedAt: ISSUED_AT });
    const verdict = evaluateExchange(exchange, SECRET);

    // The verifier reaches the identical bounded score from the same evidence —
    // never higher (no inflation), and here not lower (same default policy).
    expect(verdict.trust?.overall.score).toBe(issuerTrust.overall.score);
    expect(verdict.trust?.overall.decisionGradeEvidence).toBe(issuerTrust.overall.decisionGradeEvidence);
  });

  it('fails closed on a tampered envelope — no trust derived', () => {
    const collection = issuerCollection();
    const exchange = buildEvidenceExchange({ issuer: 'org-mercy-health', collection, secret: SECRET, issuedAt: ISSUED_AT });

    // Tamper: flip a self-reported credential to look checked AFTER signing.
    const tampered = structuredClone(exchange);
    const target = tampered.collection.objects.find((o) => o.status !== 'checked');
    if (target) target.status = 'checked';

    expect(verifyExchangeSignature(tampered, SECRET)).toBe(false);
    const verdict = evaluateExchange(tampered, SECRET);
    expect(verdict.signatureValid).toBe(false);
    expect(verdict.trust).toBeNull();
    expect(verdict.readiness).toBeNull();
  });

  it('rejects a wrong/foreign secret (sender outside the federation secret)', () => {
    const collection = issuerCollection();
    const exchange = buildEvidenceExchange({ issuer: 'org-mercy-health', collection, secret: SECRET, issuedAt: ISSUED_AT });

    expect(verifyExchangeSignature(exchange, 'a-different-secret')).toBe(false);
    expect(evaluateExchange(exchange, 'a-different-secret').signatureValid).toBe(false);
  });

  it('refuses non-members and members lacking the issuer role at the federation boundary', () => {
    expect(authorizeIssuer(demoFederation(), 'org-unknown').authorized).toBe(false);
    // Coastal is a verifier-only member → may not issue.
    expect(authorizeIssuer(demoFederation(), 'org-coastal-staffing').authorized).toBe(false);
  });

  it('honest absence: the exchanged evidence never claims a non-integrated source as checked', () => {
    const exchange = buildEvidenceExchange({ issuer: 'org-mercy-health', collection: issuerCollection(), secret: SECRET, issuedAt: ISSUED_AT });
    // ABMS board cert is self-reported in the demo — must remain non-decision-grade.
    for (const obj of exchange.collection.objects) {
      if (obj.status === 'checked') {
        expect(obj.decisionGrade).toBe(true);
      } else {
        expect(obj.decisionGrade).toBe(false);
      }
    }
  });
});
