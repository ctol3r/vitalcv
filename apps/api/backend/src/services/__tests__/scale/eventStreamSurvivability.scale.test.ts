/**
 * W2-PR38A — Event-Stream Survivability (scale gate)
 *
 * Drives the runtime trust cohesion + tenant-isolation surfaces under
 * sustained mutation-event bursts and asserts that the event stream
 * survives saturation without silent collapse.
 *
 * Invariants the gate exists to protect:
 *
 *   1. burst survivability — 10 000 mutation-metadata events emitted
 *      back-to-back complete within the CI budget AND every event lands
 *      with a distinct fingerprint (no event lost to hash collision).
 *   2. interleaved survivability — alternating allowed / denied events
 *      maintain ambiguity (R-CAT-5 + denialReason co-occur every time)
 *      under burst load — no silent reclassification.
 *   3. tenant boundary survivability — a multi-tenant burst preserves
 *      drift-signature partitioning (driftSignaturesShareTenant returns
 *      true within tenant, false across tenants) for every event.
 *   4. failure stream survivability — when 25 % of mutation calls hit
 *      a forced denial, the denial-rate observed in the metadata stream
 *      stays within 1 % of the injected rate. No silent drop, no silent
 *      promotion.
 *
 * Pure mock-free test — exercises the real cohesion + isolation modules.
 */

import {
  buildRuntimeMutationMetadata,
  type RuntimeMutationAction,
} from '../../runtimeTrustCohesion';
import {
  buildTenantDriftSignature,
  driftSignaturesShareTenant,
} from '../../multi-tenant/tenantIsolation';

const ALL_ACTIONS: RuntimeMutationAction[] = [
  'accept',
  'request-refresh',
  'route-to-review',
  'packet-export',
  'share-packet',
  'confirm-start',
  'denied-mutation',
  'dossier-replay',
];

describe('event-stream survivability scale (W2-PR38A scale gate)', () => {
  it('survives a 10 000-event mutation burst without fingerprint collapse', () => {
    const N = 10_000;
    const fingerprints = new Set<string>();
    const correlations = new Set<string>();
    const start = process.hrtime.bigint();

    for (let i = 0; i < N; i++) {
      const action = ALL_ACTIONS[i % ALL_ACTIONS.length];
      const meta = buildRuntimeMutationMetadata({
        action,
        actorId: `actor-${i % 200}`,
        entityId: `entity-${i}`,
        clinicianNpi: `${1_000_000_000 + i}`,
        correlationId: `corr-${i}`,
        outcome: action === 'denied-mutation' ? 'denied' : 'allowed',
        ...(action === 'denied-mutation'
          ? { denialReason: 'readonly_blocks_mutation' }
          : {}),
      });
      fingerprints.add(meta.mutationFingerprint);
      correlations.add(meta.correlationId);
    }

    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    const eventsPerSec = (N / elapsedMs) * 1000;
    const survivabilityPct = (fingerprints.size / N) * 100;

    // Every distinct entityId yields a distinct fingerprint — no collapse.
    expect(fingerprints.size).toBe(N);
    // Every supplied correlationId is preserved verbatim.
    expect(correlations.size).toBe(N);
    // Generous CI budget; the gate exists to catch silent collapse, not flake.
    expect(elapsedMs).toBeLessThan(8_000);

    // eslint-disable-next-line no-console
    console.log(
      `[scale-board] event-stream-survivability-pct=${survivabilityPct.toFixed(2)} ` +
        `n=${N} events_per_sec=${eventsPerSec.toFixed(0)} elapsed_ms=${elapsedMs.toFixed(0)}`,
    );
  });

  it('preserves ambiguity under interleaved allow/deny burst (no silent reclassification)', () => {
    const N = 4000;
    let denialAmbiguityIntact = 0;
    let allowedAmbiguityIntact = 0;
    // Allowed-action rotation MUST exclude 'denied-mutation' so the
    // "allowed" branch never inherits R-CAT-5 / DENIED_MUTATION from a
    // mismatched action selection.
    const ALLOWED_ACTIONS: RuntimeMutationAction[] = ALL_ACTIONS.filter(
      a => a !== 'denied-mutation',
    );

    for (let i = 0; i < N; i++) {
      const isDenied = i % 4 === 0; // 25 % deny rate
      const action: RuntimeMutationAction = isDenied
        ? 'denied-mutation'
        : ALLOWED_ACTIONS[i % ALLOWED_ACTIONS.length];
      const meta = buildRuntimeMutationMetadata({
        action,
        actorId: `actor-${i}`,
        entityId: `entity-${i}`,
        outcome: isDenied ? 'denied' : 'allowed',
        ...(isDenied
          ? { denialReason: `denial-${i}`, readonly: { attemptedByReadonly: true, source: 'x-verifier-team-role' } }
          : {}),
      });

      if (isDenied) {
        if (
          meta.outcome === 'denied' &&
          meta.replayCategory === 'R-CAT-5' &&
          meta.mutationClassification === 'DENIED_MUTATION' &&
          meta.denialReason === `denial-${i}`
        ) {
          denialAmbiguityIntact++;
        }
      } else {
        if (
          meta.outcome === 'allowed' &&
          meta.replayCategory !== 'R-CAT-5' &&
          meta.mutationClassification !== 'DENIED_MUTATION' &&
          meta.denialReason === undefined
        ) {
          allowedAmbiguityIntact++;
        }
      }
    }

    const expectedDenied = Math.ceil(N / 4);
    const expectedAllowed = N - expectedDenied;
    expect(denialAmbiguityIntact).toBe(expectedDenied);
    expect(allowedAmbiguityIntact).toBe(expectedAllowed);

    // eslint-disable-next-line no-console
    console.log(
      `[scale-board] ambiguity-intact-pct=100.00 ` +
        `denied=${denialAmbiguityIntact}/${expectedDenied} allowed=${allowedAmbiguityIntact}/${expectedAllowed}`,
    );
  });

  it('partitions a multi-tenant drift-signature burst without bleedover', () => {
    const TENANTS = ['org-tenant-A', 'org-tenant-B', 'org-tenant-C', null];
    const PER_TENANT = 250;
    const signaturesByTenant = new Map<string, ReturnType<typeof buildTenantDriftSignature>[]>();

    for (const t of TENANTS) {
      const tenantKey = t ?? '__no_tenant__';
      const list: ReturnType<typeof buildTenantDriftSignature>[] = [];
      for (let i = 0; i < PER_TENANT; i++) {
        list.push(
          buildTenantDriftSignature({
            tenantId: t,
            driftSeverity: i % 3 === 0 ? 'CRITICAL' : 'WARNING',
            source: 'replayEngine',
            payload: { capsuleId: `${tenantKey}-cap-${i}`, idx: i },
          }),
        );
      }
      signaturesByTenant.set(tenantKey, list);
    }

    // Within-tenant pairs MUST share tenant. Cross-tenant pairs MUST NOT.
    let sameTenantHits = 0;
    let crossTenantBleeds = 0;
    for (const [keyA, listA] of signaturesByTenant.entries()) {
      for (const [keyB, listB] of signaturesByTenant.entries()) {
        const a = listA[0];
        const b = listB[Math.floor(listB.length / 2)];
        const shares = driftSignaturesShareTenant(a, b);
        if (keyA === keyB) {
          if (shares) sameTenantHits++;
          else crossTenantBleeds++; // wrong direction but count distinctly
        } else {
          if (shares) crossTenantBleeds++;
        }
      }
    }
    expect(crossTenantBleeds).toBe(0);
    // Same-tenant pairs: 4 tenants × 1 self-pair each = 4
    expect(sameTenantHits).toBe(TENANTS.length);

    // Within-tenant signatures must all share tenantId; the digest itself
    // varies because the payload varies, so we check tenantId equality
    // and uniqueness of `signature` (no two events collide).
    for (const [tenantKey, list] of signaturesByTenant.entries()) {
      const tenantIds = new Set(list.map(s => s.tenantId));
      const signatures = new Set(list.map(s => s.signature));
      expect(tenantIds).toEqual(new Set([tenantKey]));
      expect(signatures.size).toBe(PER_TENANT);
    }

    // eslint-disable-next-line no-console
    console.log(
      `[scale-board] drift-signature-bleedover=${crossTenantBleeds} ` +
        `tenants=${TENANTS.length} per_tenant=${PER_TENANT}`,
    );
  });

  it('keeps observed denial-rate within 1 % of injected rate at N=2000', () => {
    const N = 2000;
    const INJECTED_DENIAL_RATE = 0.25;
    let observedDenied = 0;

    for (let i = 0; i < N; i++) {
      const isDenied = i % Math.round(1 / INJECTED_DENIAL_RATE) === 0;
      const meta = buildRuntimeMutationMetadata({
        action: isDenied ? 'denied-mutation' : 'accept',
        actorId: `actor-${i}`,
        entityId: `entity-${i}`,
        outcome: isDenied ? 'denied' : 'allowed',
        ...(isDenied ? { denialReason: 'forced' } : {}),
      });
      if (meta.outcome === 'denied') observedDenied++;
    }

    const observedRate = observedDenied / N;
    const drift = Math.abs(observedRate - INJECTED_DENIAL_RATE);
    expect(drift).toBeLessThan(0.01);

    // eslint-disable-next-line no-console
    console.log(
      `[scale-board] denial-rate-drift=${(drift * 100).toFixed(2)}% ` +
        `injected=${(INJECTED_DENIAL_RATE * 100).toFixed(0)}% observed=${(observedRate * 100).toFixed(2)}%`,
    );
  });
});
