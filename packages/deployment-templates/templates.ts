/**
 * W2-PR80A — Institutional deployment template registry.
 *
 * Templates are immutable. New behavior ships as a new templateVersion.
 * Each template is keyed by (templateId, templateVersion); presets bind to both.
 */

import type {
  DeploymentTemplate,
  EnvVarRequirement,
  FeatureFlagRequirement,
  InstitutionRole,
} from './types';
import { DEPLOYMENT_TEMPLATE_SCHEMA } from './types';

// Factory helpers preserve literal types through Object.freeze without widening.
const envVar = (input: EnvVarRequirement): EnvVarRequirement => Object.freeze({ ...input });
const flag = (input: FeatureFlagRequirement): FeatureFlagRequirement =>
  Object.freeze({ ...input });
const template = (input: DeploymentTemplate): DeploymentTemplate => Object.freeze({ ...input });

/**
 * Template: health-system issuer.
 * Hospitals / health systems issuing employer-acceptance credentials.
 */
export const HEALTH_SYSTEM_ISSUER_V1: DeploymentTemplate = template({
  schema: DEPLOYMENT_TEMPLATE_SCHEMA,
  templateId: 'vitalcv.template.health-system-issuer',
  templateVersion: '1.0.0',
  role: 'health-system-issuer',
  description:
    'Health-system issuer template. Single-tenant; emits issuer-side recognition / acceptance events. Foundation-state compliance.',
  policyBundleIds: Object.freeze(['vitalcv.bundle.foundation', 'vitalcv.bundle.issuer']),
  envVars: Object.freeze([
    envVar({
      name: 'DATABASE_URL',
      scope: 'all',
      required: true,
      rationale: 'Primary tenant data store; presence required for audit ledger.',
    }),
    envVar({
      name: 'TENANT_ID',
      scope: 'all',
      required: true,
      rationale: 'Binds all replay reconstructions to this institution.',
    }),
    envVar({
      name: 'ISSUER_SIGNING_KID',
      scope: 'all',
      required: true,
      rationale: 'ES256 key id for issuer signatures; HS256 is non-negotiable banned.',
    }),
  ]),
  featureFlags: Object.freeze([
    flag({ name: 'feature.issuer.recognition', defaultState: 'on', loadBearing: true }),
    flag({ name: 'feature.issuer.acceptance', defaultState: 'on', loadBearing: true }),
    flag({ name: 'feature.issuer.start-attested', defaultState: 'on', loadBearing: false }),
  ]),
  tenantScope: 'single',
  requiresCodexSafe: true,
  applyAuditEvent: 'TRUST_STATE_CHECK',
});

/**
 * Template: payer / employer verifier.
 */
export const PAYER_VERIFIER_V1: DeploymentTemplate = template({
  schema: DEPLOYMENT_TEMPLATE_SCHEMA,
  templateId: 'vitalcv.template.payer-verifier',
  templateVersion: '1.0.0',
  role: 'payer-verifier',
  description:
    'Payer/employer verifier template. Single-tenant; consumes issuer credentials, emits replay artifacts.',
  policyBundleIds: Object.freeze(['vitalcv.bundle.foundation', 'vitalcv.bundle.verifier']),
  envVars: Object.freeze([
    envVar({
      name: 'DATABASE_URL',
      scope: 'all',
      required: true,
      rationale: 'Verifier-side store; isolated from issuer DB.',
    }),
    envVar({
      name: 'TENANT_ID',
      scope: 'all',
      required: true,
      rationale: 'Verifier tenant scope; replay results bound to this ID.',
    }),
    envVar({
      name: 'VERIFIER_TRUST_ROOTS',
      scope: 'all',
      required: true,
      rationale:
        'Comma-separated trust-anchor IDs the verifier accepts. Empty value = fail-closed.',
    }),
  ]),
  featureFlags: Object.freeze([
    flag({ name: 'feature.verifier.replay', defaultState: 'on', loadBearing: true }),
    flag({ name: 'feature.verifier.audit-bundle-export', defaultState: 'on', loadBearing: true }),
    flag({ name: 'feature.verifier.containment-report', defaultState: 'on', loadBearing: true }),
  ]),
  tenantScope: 'single',
  requiresCodexSafe: true,
  applyAuditEvent: 'TRUST_STATE_CHECK',
});

/**
 * Template: pilot-isolated tenant.
 * Time-boxed pilot deployment; relaxed superadmin gate; isolated tenant.
 */
export const PILOT_TENANT_V1: DeploymentTemplate = template({
  schema: DEPLOYMENT_TEMPLATE_SCHEMA,
  templateId: 'vitalcv.template.pilot-tenant',
  templateVersion: '1.0.0',
  role: 'pilot-tenant',
  description:
    'Pilot-isolated tenant template. Superadmin gate disabled. Not for production. Time-boxed evaluation only.',
  policyBundleIds: Object.freeze(['vitalcv.bundle.foundation', 'vitalcv.bundle.pilot']),
  envVars: Object.freeze([
    envVar({
      name: 'DATABASE_URL',
      scope: 'all',
      required: true,
      rationale: 'Pilot store; MUST be isolated DB from any prod tenant.',
    }),
    envVar({
      name: 'TENANT_ID',
      scope: 'all',
      required: true,
      rationale: 'Pilot tenant ID; replay scope.',
    }),
    envVar({
      name: 'PILOT_EXPIRES_AT',
      scope: 'pilot',
      required: true,
      rationale: 'ISO date; pilot rejects all writes after this timestamp.',
    }),
  ]),
  featureFlags: Object.freeze([
    flag({ name: 'feature.pilot.exploration', defaultState: 'on', loadBearing: false }),
  ]),
  tenantScope: 'pilot-isolated',
  requiresCodexSafe: false,
  applyAuditEvent: 'TRUST_STATE_CHECK',
});

/**
 * Template: multi-region issuer (federated).
 */
export const MULTI_REGION_ISSUER_V1: DeploymentTemplate = template({
  schema: DEPLOYMENT_TEMPLATE_SCHEMA,
  templateId: 'vitalcv.template.multi-region-issuer',
  templateVersion: '1.0.0',
  role: 'multi-region-issuer',
  description:
    'Multi-region federated issuer template. Production-hardened posture in prod env; foundation in lower envs.',
  policyBundleIds: Object.freeze([
    'vitalcv.bundle.foundation',
    'vitalcv.bundle.issuer',
    'vitalcv.bundle.production-hardened',
  ]),
  envVars: Object.freeze([
    envVar({
      name: 'DATABASE_URL',
      scope: 'all',
      required: true,
      rationale: 'Region-local primary store.',
    }),
    envVar({
      name: 'TENANT_ID',
      scope: 'all',
      required: true,
      rationale: 'Federation primary tenant ID.',
    }),
    envVar({
      name: 'FEDERATION_ID',
      scope: 'all',
      required: true,
      rationale: 'Federation envelope; binds replay to federation governance.',
    }),
    envVar({
      name: 'REGION_CODE',
      scope: 'all',
      required: true,
      rationale: 'Region label for lineage; informs drift detection across regions.',
    }),
    envVar({
      name: 'ISSUER_SIGNING_KID',
      scope: 'all',
      required: true,
      rationale: 'ES256 only. HS256 non-negotiable banned.',
    }),
  ]),
  featureFlags: Object.freeze([
    flag({ name: 'feature.issuer.recognition', defaultState: 'on', loadBearing: true }),
    flag({ name: 'feature.issuer.acceptance', defaultState: 'on', loadBearing: true }),
    flag({ name: 'feature.federation.governance', defaultState: 'on', loadBearing: true }),
  ]),
  tenantScope: 'federated',
  requiresCodexSafe: true,
  applyAuditEvent: 'TRUST_STATE_CHECK',
});

const REGISTRY: ReadonlyMap<string, DeploymentTemplate> = new Map([
  [HEALTH_SYSTEM_ISSUER_V1.templateId, HEALTH_SYSTEM_ISSUER_V1],
  [PAYER_VERIFIER_V1.templateId, PAYER_VERIFIER_V1],
  [PILOT_TENANT_V1.templateId, PILOT_TENANT_V1],
  [MULTI_REGION_ISSUER_V1.templateId, MULTI_REGION_ISSUER_V1],
]);

export function getTemplate(templateId: string): DeploymentTemplate {
  const found = REGISTRY.get(templateId);
  if (!found) {
    throw new Error(`deployment-templates: unknown template ${templateId}`);
  }
  return found;
}

export function listTemplates(): ReadonlyArray<DeploymentTemplate> {
  return Array.from(REGISTRY.values());
}

export function listTemplatesByRole(role: InstitutionRole): ReadonlyArray<DeploymentTemplate> {
  return listTemplates().filter((t) => t.role === role);
}
