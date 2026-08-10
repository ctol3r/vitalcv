/**
 * Customer-facing copy authored by the BACKEND.
 *
 * `scripts/check-public-claims.ts` — the repo's copy gate — scans exactly three
 * roots: `apps/web/app`, `apps/web/components`, `apps/marketing`. Every string
 * this service hands to a reader lives outside all three, so the gate has never
 * been able to see it. That is not hypothetical: the wave that retired "wallet"
 * from customer language left `'Current Wallet evidence is shown separately…'`
 * untouched in the read service, where it rendered verbatim on the employer
 * surface with every gate green.
 *
 * This suite is the missing half of that gate. It asserts on strings the code
 * ACTUALLY PRODUCES — absence reasons are driven through every branch that can
 * generate one, rather than grepped out of the source, so a reason assembled at
 * runtime cannot slip past the way a static scan would allow.
 */

import {
  buildSectionAbsencesFromTrustState,
  type AbsenceTrustSignals,
  type PacketFieldEntry,
} from '../applicationPacketService';
import { CURRENT_EVIDENCE_NOTICES } from '../applicationPacketReadService';
import { limitationsForFields } from '../../apply/applyIntentService';

/**
 * EC-9's banned customer-facing nouns, as written in the Experience
 * Constitution. Matched case-insensitively on word boundaries so "Packet",
 * "packets" and "PACKET" all fail — and so "packetVersion" in an identifier
 * does not, because this suite only ever inspects rendered STRINGS.
 */
const EC9_BANNED_NOUNS = [
  'packet',
  'artifact',
  'lane',
  'evidence network',
  'provenance',
  'holder',
  'readiness score',
  'passport',
  'wallet',
  'trust tier',
  'dossier',
  'credential object',
] as const;

function bannedNounsIn(copy: string): string[] {
  return EC9_BANNED_NOUNS.filter((noun) => {
    const pattern = new RegExp(`\\b${noun.replace(/ /g, '\\s+')}s?\\b`, 'i');
    return pattern.test(copy);
  });
}

const COVERAGE_STATES = [
  'checked',
  'notFound',
  'reviewRequired',
  'accessRequired',
  'gated',
  'unavailable',
  'pending',
  'stale',
  'notDecisionGrade',
  'previewOnly',
] as const;

const SECTIONS = ['identity', 'exclusions', 'licensure', 'enrollment'] as const;

/**
 * Every absence reason the builder can produce: each section × each coverage
 * state × (contradiction / no contradiction) × (source note / none), plus the
 * no-coverage fallback. The point is coverage of the GENERATOR, not a sample.
 */
function everyGeneratedReason(): string[] {
  const noFields: PacketFieldEntry[] = [];
  const reasons: string[] = [];

  const claimingSignals: AbsenceTrustSignals = {
    identityVerified: true,
    exclusionStatus: 'CLEAR',
    licensureStatus: 'verified',
    pecosStatus: 'ENROLLED',
  };

  for (const sectionId of SECTIONS) {
    // No coverage at all — the conservative fallback.
    for (const signals of [{}, claimingSignals]) {
      reasons.push(
        ...buildSectionAbsencesFromTrustState(signals, [sectionId], noFields)
          .map((absence) => absence.reason),
      );
    }

    for (const state of COVERAGE_STATES) {
      for (const reason of ['', 'OIG LEIE check clear']) {
        for (const signals of [{}, claimingSignals]) {
          const withCoverage: AbsenceTrustSignals = {
            ...signals,
            sourceCoverage: [{
              sourceId: sectionId === 'identity' ? 'NPPES_API'
                : sectionId === 'exclusions' ? 'OIG_LEIE'
                  : sectionId === 'licensure' ? 'STATE_BOARD' : 'PECOS_PUBLIC',
              state,
              reason,
            }],
          };
          reasons.push(
            ...buildSectionAbsencesFromTrustState(withCoverage, [sectionId], noFields)
              .map((absence) => absence.reason),
          );
        }
      }
    }
  }

  return reasons;
}

describe('backend customer-facing copy — EC-9 language contract', () => {
  it('generates absence reasons across every branch (guards against a vacuous sweep)', () => {
    const reasons = everyGeneratedReason();
    // If the generator ever stops producing reasons, the assertions below pass
    // trivially. Pin the count to the loop's own dimensions — it survives the
    // lists growing, but catches an invocation that yields nothing.
    const perSection = 2 + COVERAGE_STATES.length * 2 * 2;
    expect(reasons).toHaveLength(SECTIONS.length * perSection);
    // …and pin the VARIETY, so a generator collapsing to one string is caught.
    expect(new Set(reasons).size).toBeGreaterThan(4);
  });

  it('never puts an EC-9 banned noun in an absence reason', () => {
    const offenders = everyGeneratedReason()
      .map((reason) => ({ reason, banned: bannedNounsIn(reason) }))
      .filter((entry) => entry.banned.length > 0);

    expect(offenders.map((entry) => `${entry.banned.join(',')} :: ${entry.reason}`)).toEqual([]);
  });

  it('never puts an EC-9 banned noun in an apply-composer limitation', () => {
    // The clinician reads these BEFORE consenting, so they are as
    // customer-facing as anything on a marketing page.
    const limitations = [
      ...limitationsForFields(SECTIONS, []),
      ...limitationsForFields(SECTIONS, [{
        sectionId: 'identity',
        fieldId: 'identity.identity.nppes',
        label: 'identity',
        value: null,
        evidenceState: 'access_required',
        sourceId: 'nppes',
        sourceObservedAt: null,
        freshUntil: null,
        artifactId: null,
        receiptId: null,
      }]),
    ];

    expect(limitations.length).toBeGreaterThan(0);
    const offenders = limitations
      .map((copy) => ({ copy, banned: bannedNounsIn(copy) }))
      .filter((entry) => entry.banned.length > 0);
    expect(offenders.map((entry) => `${entry.banned.join(',')} :: ${entry.copy}`)).toEqual([]);
  });

  it('never puts an EC-9 banned noun in a reader-facing notice', () => {
    const offenders = Object.entries(CURRENT_EVIDENCE_NOTICES)
      .map(([key, copy]) => ({ key, banned: bannedNounsIn(copy) }))
      .filter((entry) => entry.banned.length > 0);

    expect(offenders.map((entry) => `${entry.key}: ${entry.banned.join(',')}`)).toEqual([]);
  });

  it('states non-affirmation in every absence reason, so silence is never read as clean', () => {
    // The whole point of the record: a reader must not be able to take an
    // absence for a check that came back clean.
    const missing = everyGeneratedReason()
      .filter((reason) => !/^Nothing was found for /.test(reason));

    expect(missing).toEqual([]);
  });

  it('never claims an absence was verified, confirmed, or clear', () => {
    const affirmative = everyGeneratedReason().filter((reason) => {
      // "not a check that came back clean" and "a clean check" appear as
      // explicit DENIALS; strip the negations before looking for a claim.
      const withoutDenials = reason
        .replace(/not a clean check/gi, '')
        .replace(/this is not a check that came back clean/gi, '')
        .replace(/an answer, not a pending check/gi, '');
      return /\b(verified|confirmed|cleared|clean)\b/i.test(withoutDenials);
    });

    expect(affirmative).toEqual([]);
  });
});
