/**
 * W2-PR80A — Trust-policy deployment bundles.
 *
 * Bundles are the portable, composable unit of trust-policy posture.
 * A template references bundle IDs; bundles are resolved at preset-freeze time.
 *
 * Composition rule (load-bearing): later bundles MUST NOT relax the posture
 * established by earlier bundles. composeBundles() throws on relaxation.
 */

import type { PostureState, TrustPolicyBundle, TrustPolicyPosture } from './types';
import { DEPLOYMENT_BUNDLE_SCHEMA } from './types';

/**
 * Posture rank.
 *
 * - `enforced` (3) is real production enforcement.
 * - `foundation-only` (2) is wired but not enforced in production.
 * - `unverified-foundation` (1) is wired but unverified.
 * - `disabled` (1) is an intentional opt-out (e.g., pilot tenant deliberately
 *   does NOT run the superadmin gate). It is NOT strictly weaker than
 *   unverified-foundation — both are "not enforced" peers; they differ only in
 *   operator intent. So composing `[foundation(unverified-foundation), pilot(disabled)]`
 *   is allowed (not a relaxation), but `[production-hardened(enforced), pilot(disabled)]`
 *   is rejected because rank drops 3 → 1.
 */
const POSTURE_RANK: Readonly<Record<PostureState, number>> = {
  enforced: 3,
  'foundation-only': 2,
  'unverified-foundation': 1,
  disabled: 1,
};

function isAtLeast(a: PostureState, b: PostureState): boolean {
  return POSTURE_RANK[a] >= POSTURE_RANK[b];
}

/** Foundation bundle — the minimum any production deployment must include. */
export const FOUNDATION_BUNDLE: TrustPolicyBundle = Object.freeze({
  schema: DEPLOYMENT_BUNDLE_SCHEMA,
  bundleId: 'vitalcv.bundle.foundation',
  bundleVersion: '1.0.0',
  posture: Object.freeze({
    redaction: 'foundation-only',
    retention: 'foundation-only',
    authorityAdapters: 'foundation-only',
    superadminGate: 'unverified-foundation',
    complianceReport: 'unverified-foundation',
  }),
  auditEventCoverage: Object.freeze([
    'TRUST_STATE_CHECK',
    'VERIFICATION_REQUESTED',
    'VERIFICATION_COMPLETED',
    'VERIFICATION_FAILED',
  ]),
  disclaimer:
    'This bundle establishes foundation-state controls. It reflects planned controls, not enforced production policies.',
});

/** Issuer bundle — adds issuer-side audit events and acceptance posture. */
export const ISSUER_BUNDLE: TrustPolicyBundle = Object.freeze({
  schema: DEPLOYMENT_BUNDLE_SCHEMA,
  bundleId: 'vitalcv.bundle.issuer',
  bundleVersion: '1.0.0',
  posture: Object.freeze({
    redaction: 'foundation-only',
    retention: 'foundation-only',
    authorityAdapters: 'foundation-only',
    superadminGate: 'unverified-foundation',
    complianceReport: 'unverified-foundation',
  }),
  auditEventCoverage: Object.freeze([
    'PSV_RECEIPT',
    'RECOGNITION',
    'ACCEPTANCE',
    'EMPLOYER_ACCEPTANCE',
    'START_ATTESTED',
  ]),
  disclaimer:
    'Issuer bundle does not assert legal acceptance. Receipt candidates are non-decision-grade until policy review completes.',
});

/** Verifier bundle — adds verifier-side replay and bundle export coverage. */
export const VERIFIER_BUNDLE: TrustPolicyBundle = Object.freeze({
  schema: DEPLOYMENT_BUNDLE_SCHEMA,
  bundleId: 'vitalcv.bundle.verifier',
  bundleVersion: '1.0.0',
  posture: Object.freeze({
    redaction: 'foundation-only',
    retention: 'foundation-only',
    authorityAdapters: 'foundation-only',
    superadminGate: 'unverified-foundation',
    complianceReport: 'unverified-foundation',
  }),
  auditEventCoverage: Object.freeze([
    'ARTIFACT_VIEWED',
    'ARTIFACT_EXPORTED',
    'BUNDLE_GENERATED',
  ]),
  disclaimer:
    'Verifier bundle exports decision replay artifacts; it does not transfer legal risk to VitalCV.',
});

/** Pilot bundle — relaxes superadmin gate to disabled (pilot-isolated tenant). */
export const PILOT_BUNDLE: TrustPolicyBundle = Object.freeze({
  schema: DEPLOYMENT_BUNDLE_SCHEMA,
  bundleId: 'vitalcv.bundle.pilot',
  bundleVersion: '1.0.0',
  posture: Object.freeze({
    redaction: 'foundation-only',
    retention: 'foundation-only',
    authorityAdapters: 'foundation-only',
    superadminGate: 'disabled',
    complianceReport: 'unverified-foundation',
  }),
  auditEventCoverage: Object.freeze(['TRUST_STATE_CHECK', 'VERIFICATION_REQUESTED']),
  disclaimer:
    'Pilot bundle disables superadmin gate for isolated tenant pilots only. Not for production.',
});

/** Production-hardened bundle — enforced posture; gates compliance evidence. */
export const PRODUCTION_HARDENED_BUNDLE: TrustPolicyBundle = Object.freeze({
  schema: DEPLOYMENT_BUNDLE_SCHEMA,
  bundleId: 'vitalcv.bundle.production-hardened',
  bundleVersion: '1.0.0',
  posture: Object.freeze({
    redaction: 'enforced',
    retention: 'enforced',
    authorityAdapters: 'enforced',
    superadminGate: 'enforced',
    complianceReport: 'foundation-only',
  }),
  auditEventCoverage: Object.freeze([
    'TRUST_STATE_CHECK',
    'TRUST_STATE_DECAY',
    'VERIFICATION_REQUESTED',
    'VERIFICATION_COMPLETED',
    'VERIFICATION_FAILED',
    'IDEMPOTENT_REPLAY',
    'CONCURRENCY_GUARD_TRIGGERED',
  ]),
  disclaimer:
    'Production-hardened bundle enforces redaction, retention, and authority adapters. Compliance report remains foundation-shape until external attestation.',
});

const REGISTRY: ReadonlyMap<string, TrustPolicyBundle> = new Map([
  [FOUNDATION_BUNDLE.bundleId, FOUNDATION_BUNDLE],
  [ISSUER_BUNDLE.bundleId, ISSUER_BUNDLE],
  [VERIFIER_BUNDLE.bundleId, VERIFIER_BUNDLE],
  [PILOT_BUNDLE.bundleId, PILOT_BUNDLE],
  [PRODUCTION_HARDENED_BUNDLE.bundleId, PRODUCTION_HARDENED_BUNDLE],
]);

export function getBundle(bundleId: string): TrustPolicyBundle {
  const bundle = REGISTRY.get(bundleId);
  if (!bundle) {
    throw new Error(`deployment-templates: unknown bundle ${bundleId}`);
  }
  return bundle;
}

export function listBundles(): ReadonlyArray<TrustPolicyBundle> {
  return Array.from(REGISTRY.values());
}

/**
 * Compose bundles into a single posture. Throws if a later bundle relaxes
 * any field set by an earlier bundle. This is the load-bearing invariant
 * that prevents accidental posture downgrade during template composition.
 */
export function composeBundles(bundleIds: ReadonlyArray<string>): {
  posture: TrustPolicyPosture;
  auditEventCoverage: ReadonlyArray<string>;
  disclaimers: ReadonlyArray<string>;
} {
  if (bundleIds.length === 0) {
    throw new Error('deployment-templates: at least one bundle required');
  }
  const bundles = bundleIds.map((id) => getBundle(id));

  let posture: TrustPolicyPosture = bundles[0].posture;
  for (let i = 1; i < bundles.length; i++) {
    const next = bundles[i].posture;
    const fields: ReadonlyArray<keyof TrustPolicyPosture> = [
      'redaction',
      'retention',
      'authorityAdapters',
      'superadminGate',
      'complianceReport',
    ];
    for (const field of fields) {
      if (!isAtLeast(next[field], posture[field])) {
        throw new Error(
          `deployment-templates: bundle ${bundles[i].bundleId} relaxes ${field} ` +
            `from ${posture[field]} to ${next[field]} — composition rejected (fail-closed).`,
        );
      }
    }
    posture = next;
  }

  const seenEvents = new Set<string>();
  for (const b of bundles) {
    for (const e of b.auditEventCoverage) {
      seenEvents.add(e);
    }
  }
  const sortedEvents = Array.from(seenEvents).sort();

  return {
    posture,
    auditEventCoverage: Object.freeze(sortedEvents),
    disclaimers: Object.freeze(bundles.map((b) => b.disclaimer)),
  };
}
