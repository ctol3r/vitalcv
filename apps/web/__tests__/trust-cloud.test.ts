/**
 * Wave 900 — Professional Trust Cloud Platform integration (C7)
 * ──────────────────────────────────────────────────────────────────────────
 * One cloud serving multiple products, organizations, and partner apps over the
 * shared trust infrastructure. Validates platform federation, cross-org identity,
 * the application registry + partner authz, signed event streaming, no-PII
 * telemetry, and fail-closed enterprise readiness.
 */
import { describe, expect, it } from 'vitest';
import { demoPlatformRegistry, resolveCloudIdentity, findTenant } from '../lib/platform-cloud/registry';
import { demoApplicationRegistry, authorizeApplication } from '../lib/platform-cloud/applications';
import { emitPlatformEvent, type EventSubscription } from '../lib/platform-cloud/events';
import { aggregateTelemetry } from '../lib/platform-cloud/telemetry';
import { platformReadiness } from '../lib/platform-cloud/readiness';
import { computeSignature } from '../lib/platform/webhook';

describe('Trust Cloud — federation & identity (C1/C2)', () => {
  it('hosts multiple tenants (products and organizations)', () => {
    const reg = demoPlatformRegistry();
    expect(reg.tenants.length).toBeGreaterThanOrEqual(2);
    expect(reg.tenants.some((t) => t.kind === 'product')).toBe(true);
    expect(reg.tenants.some((t) => t.kind === 'organization')).toBe(true);
  });

  it('resolves one provider identity across tenants by org affiliation', () => {
    const reg = demoPlatformRegistry();
    const res = resolveCloudIdentity(reg, 'demo-clinician', ['org-mercy-health']);
    expect(res.subjectKey).toBe('demo-clinician');
    // Mercy is a member of the coastal-staffing tenant's federation.
    expect(res.tenants.map((t) => t.tenantId)).toContain('coastal-staffing');
    // An unaffiliated org resolves to no tenants (honest absence).
    expect(resolveCloudIdentity(reg, 'demo-clinician', ['org-nowhere']).tenants).toHaveLength(0);
  });
});

describe('Trust Cloud — application registry & partner authz (C3/C4)', () => {
  it('authorizes by scope and tenant, fails closed otherwise', () => {
    const apps = demoApplicationRegistry();
    expect(authorizeApplication(apps, 'app-vitalcv-web', 'reasoning:read', 'vitalcv-careers').authorized).toBe(true);
    // Partner ATS lacks reasoning:read.
    expect(authorizeApplication(apps, 'app-coastal-ats', 'reasoning:read').authorized).toBe(false);
    // Unknown app fails closed.
    expect(authorizeApplication(apps, 'app-unknown', 'identity:read').authorized).toBe(false);
    // Right scope, wrong tenant fails closed.
    expect(authorizeApplication(apps, 'app-coastal-ats', 'trust:read', 'vitalcv-careers').authorized).toBe(false);
  });
});

describe('Trust Cloud — event streaming (C5)', () => {
  const subs: EventSubscription[] = [
    { subscriptionId: 'sub-1', tenantId: 'coastal-staffing', types: ['exchange.verified'], endpoint: 'https://ats/hook', secret: 's1' },
    { subscriptionId: 'sub-2', tenantId: 'coastal-staffing', types: ['readiness.changed'], endpoint: 'https://x/hook', secret: 's2' },
    { subscriptionId: 'sub-3', tenantId: 'vitalcv-careers', types: ['exchange.verified'], endpoint: 'https://y/hook', secret: 's3' },
  ];
  const injected = { eventId: 'evt-1', timestamp: '2026-06-20T00:00:00.000Z' };

  it('fans an event only to matching tenant+type subscriptions, signed with the shared HMAC', () => {
    const deliveries = emitPlatformEvent(
      { type: 'exchange.verified', tenantId: 'coastal-staffing', subjectKey: 'demo-clinician', payload: { ok: true } },
      subs,
      injected,
    );
    expect(deliveries.map((d) => d.subscriptionId)).toEqual(['sub-1']); // not sub-2 (type) or sub-3 (tenant)
    // Signature matches the vetted webhook HMAC over `${timestamp}.${body}`.
    const d = deliveries[0];
    expect(d.signature).toBe(computeSignature(d.timestamp, d.body, 's1'));
  });

  it('drops unknown event types (fails closed, never throws)', () => {
    const deliveries = emitPlatformEvent(
      { type: 'not.a.real.type' as never, tenantId: 'coastal-staffing', subjectKey: 'x', payload: {} },
      subs,
      injected,
    );
    expect(deliveries).toHaveLength(0);
  });
});

describe('Trust Cloud — telemetry (C6) & readiness (C7)', () => {
  it('aggregates counts and rejects records carrying PII / extra keys', () => {
    const summary = aggregateTelemetry([
      { type: 'exchange.verified', tenantId: 'coastal-staffing', occurredAt: '2026-06-20T00:00:00.000Z' },
      { type: 'exchange.verified', tenantId: 'vitalcv-careers', occurredAt: '2026-06-20T00:00:01.000Z' },
      // Rejected: extra key (possible PII).
      { type: 'evidence.updated', tenantId: 'coastal-staffing', occurredAt: '2026-06-20T00:00:02.000Z', name: 'Dr. Maya Chen' },
      // Rejected: unknown type.
      { type: 'bogus', tenantId: 'x', occurredAt: '2026-06-20T00:00:03.000Z' },
    ]);
    expect(summary.total).toBe(2);
    expect(summary.byType['exchange.verified']).toBe(2);
    expect(summary.tenantCount).toBe(2);
  });

  it('fail-closed readiness: a tenant with no signing secret is not ready', () => {
    const reg = demoPlatformRegistry();
    // No secret configured for any tenant.
    const none = platformReadiness(reg, () => undefined, true);
    expect(none.ready).toBe(false);
    expect(none.tenants.every((t) => !t.ready)).toBe(true);

    // All tenants configured ⇒ ready.
    const all = platformReadiness(reg, () => 'configured-secret', true);
    expect(all.ready).toBe(true);
  });
});
