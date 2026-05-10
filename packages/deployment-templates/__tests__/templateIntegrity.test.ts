import { describe, expect, it } from 'vitest';
import {
  DEPLOYMENT_TEMPLATE_SCHEMA,
  HEALTH_SYSTEM_ISSUER_V1,
  MULTI_REGION_ISSUER_V1,
  PAYER_VERIFIER_V1,
  PILOT_TENANT_V1,
  getTemplate,
  listTemplates,
  listTemplatesByRole,
} from '../index';

describe('W2-PR80A template integrity', () => {
  it('every template uses the canonical schema', () => {
    for (const t of listTemplates()) {
      expect(t.schema).toBe(DEPLOYMENT_TEMPLATE_SCHEMA);
    }
  });

  it('templates are immutable (frozen)', () => {
    expect(Object.isFrozen(HEALTH_SYSTEM_ISSUER_V1)).toBe(true);
    expect(Object.isFrozen(PAYER_VERIFIER_V1)).toBe(true);
    expect(Object.isFrozen(PILOT_TENANT_V1)).toBe(true);
    expect(Object.isFrozen(MULTI_REGION_ISSUER_V1)).toBe(true);
  });

  it('templateId is unique across the registry', () => {
    const ids = listTemplates().map((t) => t.templateId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('issuer-style templates require Codex SAFE; pilot does not', () => {
    expect(HEALTH_SYSTEM_ISSUER_V1.requiresCodexSafe).toBe(true);
    expect(PAYER_VERIFIER_V1.requiresCodexSafe).toBe(true);
    expect(MULTI_REGION_ISSUER_V1.requiresCodexSafe).toBe(true);
    expect(PILOT_TENANT_V1.requiresCodexSafe).toBe(false);
  });

  it('every template names DATABASE_URL and TENANT_ID env vars', () => {
    for (const t of listTemplates()) {
      const names = t.envVars.map((v) => v.name);
      expect(names).toContain('DATABASE_URL');
      expect(names).toContain('TENANT_ID');
    }
  });

  it('multi-region issuer uses production-hardened bundle', () => {
    expect(MULTI_REGION_ISSUER_V1.policyBundleIds).toContain(
      'vitalcv.bundle.production-hardened',
    );
  });

  it('listTemplatesByRole filters correctly', () => {
    const issuers = listTemplatesByRole('health-system-issuer');
    expect(issuers).toHaveLength(1);
    expect(issuers[0].templateId).toBe(HEALTH_SYSTEM_ISSUER_V1.templateId);

    const pilots = listTemplatesByRole('pilot-tenant');
    expect(pilots).toHaveLength(1);
    expect(pilots[0].templateId).toBe(PILOT_TENANT_V1.templateId);
  });

  it('getTemplate throws fail-closed on unknown id', () => {
    expect(() => getTemplate('nonexistent')).toThrow(/unknown template/);
  });

  it('every template applyAuditEvent is a known event type label', () => {
    const allowed = new Set([
      'TRUST_STATE_CHECK',
      'VERIFICATION_REQUESTED',
      'VERIFICATION_COMPLETED',
    ]);
    for (const t of listTemplates()) {
      expect(allowed.has(t.applyAuditEvent)).toBe(true);
    }
  });

  it('load-bearing flags are explicitly declared', () => {
    for (const t of listTemplates()) {
      const loadBearing = t.featureFlags.filter((f) => f.loadBearing);
      // Every template must have at least one load-bearing flag OR explicitly
      // none (pilot has none, by design — pilot is exploratory).
      if (t.role === 'pilot-tenant') {
        expect(loadBearing).toHaveLength(0);
      } else {
        expect(loadBearing.length).toBeGreaterThan(0);
      }
    }
  });

  it('pilot-tenant template uses pilot-isolated tenant scope', () => {
    expect(PILOT_TENANT_V1.tenantScope).toBe('pilot-isolated');
  });

  it('multi-region template uses federated tenant scope', () => {
    expect(MULTI_REGION_ISSUER_V1.tenantScope).toBe('federated');
  });
});
