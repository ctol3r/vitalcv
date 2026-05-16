/**
 * _testFixtures.ts — W2-PR120A
 *
 * Deterministic fixtures for the adoption-flywheel test surface. Builds
 * AuditBundle + AdoptionSignal slices that exercise every invariant.
 */
import type { AuditBundle, DecisionReplay } from '../audit/replayEngine';
import type {
  AdoptionSignal,
  AdoptionFlywheelInputs,
  InstitutionIdentity,
} from './adoptionFlywheelModel';

export function makeReplay(args: {
  capsuleId: string;
  containmentVerdict?: 'CLEAN' | 'QUARANTINED' | 'AMBIGUOUS' | 'CONTAMINATED' | 'CONTAINMENT_BREACH';
}): DecisionReplay {
  const verdict = args.containmentVerdict ?? 'CLEAN';
  return {
    capsuleId: args.capsuleId,
    capsuleHash: `hash-${args.capsuleId}`,
    decisionRendered: 'verifier_review_pending',
    timestamp: '2026-05-09T00:00:00.000Z',
    reasonsForDecision: [],
    containment: {
      schema: 'vitalcv.replay-corruption-containment.v1',
      capsuleId: args.capsuleId,
      verdict,
      kind: verdict === 'CLEAN' ? null : 'INTEGRITY_FAILURE',
      ambiguous: verdict === 'AMBIGUOUS',
      reason: 'fixture',
      containmentDigest: `digest-${args.capsuleId}`,
      isolatedAt: '2026-05-09T00:00:00.000Z',
      lineageHints: { subjectNpi: '0000000000', credentialIds: [], sourceReferenceId: null },
    },
  } as unknown as DecisionReplay;
}

export function makeBundle(args: {
  bundleId: string;
  capsuleIds: string[];
  breached?: boolean;
}): AuditBundle {
  const replays = args.capsuleIds.map(id =>
    makeReplay({
      capsuleId: id,
      containmentVerdict: args.breached ? 'CONTAINMENT_BREACH' : 'CLEAN',
    }),
  );
  return {
    schema: 'https://vitalcv.com/audit-bundle/v1',
    bundleVersion: '1.0',
    bundleId: args.bundleId,
    bundleHash: args.breached ? '' : `bundle-hash-${args.bundleId}`,
    exportedAt: '2026-05-09T00:00:00.000Z',
    subject: { npi: '0000000000', did: 'did:vitalcv:fixture' },
    capsuleCount: args.capsuleIds.length,
    issuer: 'VitalCV',
    methodology: 'fixture',
    replays,
    verificationInstructions: {
      hashAlgorithm: 'SHA-256',
      how: 'fixture',
      replayEndpoint: 'fixture://replay',
      verifyEndpoint: 'fixture://verify',
    },
  } as unknown as AuditBundle;
}

export function makeInstitution(institutionId: string, role: InstitutionIdentity['role']): InstitutionIdentity {
  return {
    schema: 'vitalcv.adoption-institution.v1',
    institutionId,
    role,
    category: role === 'ISSUER' ? 'Issuer Health System' : 'Reuser Network Partner',
  };
}

export function makeSignal(args: {
  signalId: string;
  observedAt: string;
  issuerInstitutionId: string;
  reuserInstitutionId: string;
  sourceBundleId: string;
  sourceCapsuleId: string;
  signalType: AdoptionSignal['signalType'];
  ageMs?: number;
}): AdoptionSignal {
  return {
    schema: 'vitalcv.adoption-signal.v1',
    signalId: args.signalId,
    observedAt: args.observedAt,
    issuerInstitutionId: args.issuerInstitutionId,
    reuserInstitutionId: args.reuserInstitutionId,
    sourceBundleId: args.sourceBundleId,
    sourceCapsuleId: args.sourceCapsuleId,
    signalType: args.signalType,
    ageMs: args.ageMs ?? 86_400_000,
  };
}

/**
 * Returns a balanced flywheel slice: 1 issuer, 3 reusers, mixed signal
 * types, no breaches.
 */
export function makeFlywheelInputs(args: {
  issuerCount?: number;
  reuserCount?: number;
  signalsPerReuser?: number;
  referralsPerReuser?: number;
  observedAtStart?: string;
} = {}): AdoptionFlywheelInputs {
  const issuerCount = args.issuerCount ?? 1;
  const reuserCount = args.reuserCount ?? 3;
  const signalsPerReuser = args.signalsPerReuser ?? 2;
  const referralsPerReuser = args.referralsPerReuser ?? 1;
  const startMs = Date.parse(args.observedAtStart ?? '2026-05-01T00:00:00.000Z');

  const issuers: InstitutionIdentity[] = Array.from({ length: issuerCount }, (_, i) =>
    makeInstitution(`issuer-${i}`, 'ISSUER'),
  );
  const reusers: InstitutionIdentity[] = Array.from({ length: reuserCount }, (_, i) =>
    makeInstitution(`reuser-${i}`, 'REUSER'),
  );

  const capsuleIds = issuers.flatMap((iss, idx) =>
    Array.from({ length: signalsPerReuser * reuserCount }, (_, j) => `${iss.institutionId}-cap-${idx}-${j}`),
  );
  const bundle = makeBundle({ bundleId: 'bundle-fixture', capsuleIds });

  const signals: AdoptionSignal[] = [];
  let cursor = startMs;
  let signalIdx = 0;
  for (const issuer of issuers) {
    for (const reuser of reusers) {
      for (let k = 0; k < signalsPerReuser; k++) {
        signals.push(
          makeSignal({
            signalId: `sig-reuse-${signalIdx++}`,
            observedAt: new Date(cursor).toISOString(),
            issuerInstitutionId: issuer.institutionId,
            reuserInstitutionId: reuser.institutionId,
            sourceBundleId: bundle.bundleId,
            sourceCapsuleId: capsuleIds[signalIdx % capsuleIds.length],
            signalType: 'REPLAY_REUSE',
          }),
        );
        cursor += 86_400_000;
      }
      for (let r = 0; r < referralsPerReuser; r++) {
        signals.push(
          makeSignal({
            signalId: `sig-ref-${signalIdx++}`,
            observedAt: new Date(cursor).toISOString(),
            issuerInstitutionId: reuser.institutionId,
            reuserInstitutionId: `${reuser.institutionId}-downstream-${r}`,
            sourceBundleId: bundle.bundleId,
            sourceCapsuleId: capsuleIds[signalIdx % capsuleIds.length],
            signalType: 'REFERRAL_INTRODUCTION',
          }),
        );
        cursor += 86_400_000;
      }
    }
  }

  const downstream: InstitutionIdentity[] = [];
  const seenDownstream = new Set<string>();
  for (const s of signals) {
    if (s.signalType === 'REFERRAL_INTRODUCTION' && !seenDownstream.has(s.reuserInstitutionId)) {
      downstream.push(makeInstitution(s.reuserInstitutionId, 'REFEREE'));
      seenDownstream.add(s.reuserInstitutionId);
    }
  }

  return {
    signals,
    institutions: [...issuers, ...reusers, ...downstream],
    auditBundles: [bundle],
    sliceWindow: {
      from: signals[0]?.observedAt ?? new Date(startMs).toISOString(),
      to: signals[signals.length - 1]?.observedAt ?? new Date(startMs).toISOString(),
    },
  };
}
