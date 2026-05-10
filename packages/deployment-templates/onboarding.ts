/**
 * W2-PR80A — Environment onboarding kits.
 *
 * An onboarding kit is the artifact handed to an institution operator before
 * they apply a template. The kit is deterministic given (templateId,
 * templateVersion, institutionId, env) — same inputs always produce the same
 * kit and the same kitHash.
 *
 * Disclaimers from each composed bundle are preserved verbatim in the kit;
 * operators see the same disclaimer text the platform stores in compliance
 * evidence reports.
 */

import crypto from 'crypto';
import type { DeploymentEnv, EnvVarRequirement, OnboardingKit } from './types';
import { DEPLOYMENT_ONBOARDING_SCHEMA } from './types';
import { getTemplate } from './templates';
import { composeBundles } from './policyBundles';
import { stableStringify } from './presets';

const PREFLIGHT_CHECKLIST_ITEMS: ReadonlyArray<{
  id: string;
  description: string;
  required: true;
}> = Object.freeze([
  Object.freeze({
    id: 'preflight.tenant-id-allocated',
    description:
      'Tenant ID has been allocated and recorded with VitalCV operations. Cross-tenant collision not possible.',
    required: true as const,
  }),
  Object.freeze({
    id: 'preflight.signing-key-provisioned',
    description:
      'ES256 signing key provisioned in KMS. HS256 is non-negotiable banned (PR-B closure).',
    required: true as const,
  }),
  Object.freeze({
    id: 'preflight.env-vars-staged',
    description:
      'All required env-var NAMES from this kit are configured in target environment. Values supplied separately.',
    required: true as const,
  }),
  Object.freeze({
    id: 'preflight.audit-events-monitored',
    description:
      'Operator has subscribed to expected audit-event types in their observability stack.',
    required: true as const,
  }),
  Object.freeze({
    id: 'preflight.disclaimer-acknowledged',
    description:
      'Operator has read and acknowledged each bundle disclaimer. Disclaimers cannot be edited.',
    required: true as const,
  }),
  Object.freeze({
    id: 'preflight.codex-safe-arranged',
    description:
      'For templates requiring Codex SAFE, operator has arranged a Codex verifier. Subagent stand-ins do NOT satisfy.',
    required: true as const,
  }),
]);

function computeKitHash(input: {
  templateId: string;
  templateVersion: string;
  institutionId: string;
  env: DeploymentEnv;
  envVars: ReadonlyArray<EnvVarRequirement>;
  disclaimers: ReadonlyArray<string>;
  expectedAuditEvents: ReadonlyArray<string>;
}): string {
  const canonical = {
    templateId: input.templateId,
    templateVersion: input.templateVersion,
    institutionId: input.institutionId,
    env: input.env,
    envVars: [...input.envVars].sort((a, b) => a.name.localeCompare(b.name)),
    disclaimers: [...input.disclaimers],
    expectedAuditEvents: [...input.expectedAuditEvents].sort(),
  };
  return crypto.createHash('sha256').update(stableStringify(canonical)).digest('hex');
}

export function generateOnboardingKit(input: {
  templateId: string;
  institutionId: string;
  env: DeploymentEnv;
}): OnboardingKit {
  const template = getTemplate(input.templateId);
  const composition = composeBundles(template.policyBundleIds);

  const envVars: ReadonlyArray<EnvVarRequirement> = template.envVars
    .filter((v) => v.scope === 'all' || v.scope === input.env)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const expectedAuditEvents = [
    template.applyAuditEvent,
    ...composition.auditEventCoverage,
  ].filter((value, idx, arr) => arr.indexOf(value) === idx).sort();

  const kitHash = computeKitHash({
    templateId: template.templateId,
    templateVersion: template.templateVersion,
    institutionId: input.institutionId,
    env: input.env,
    envVars,
    disclaimers: composition.disclaimers,
    expectedAuditEvents,
  });

  // Pilot template at prod env should fail-closed: pilot-isolated cannot run prod.
  if (template.tenantScope === 'pilot-isolated' && input.env === 'prod') {
    throw new Error(
      `deployment-templates: pilot-isolated template ${template.templateId} cannot be onboarded into prod env — fail-closed.`,
    );
  }

  const kitId = `kit_${template.templateId}_${input.institutionId}_${input.env}_${kitHash.slice(0, 12)}`;

  return Object.freeze({
    schema: DEPLOYMENT_ONBOARDING_SCHEMA,
    kitId,
    templateId: template.templateId,
    templateVersion: template.templateVersion,
    institutionId: input.institutionId,
    env: input.env,
    preflightChecklist: PREFLIGHT_CHECKLIST_ITEMS,
    envVars,
    disclaimers: composition.disclaimers,
    expectedAuditEvents: Object.freeze(expectedAuditEvents),
    kitHash,
  });
}

export function verifyOnboardingKit(kit: OnboardingKit): boolean {
  const recomputed = computeKitHash({
    templateId: kit.templateId,
    templateVersion: kit.templateVersion,
    institutionId: kit.institutionId,
    env: kit.env,
    envVars: kit.envVars,
    disclaimers: kit.disclaimers,
    expectedAuditEvents: kit.expectedAuditEvents,
  });
  return recomputed === kit.kitHash;
}
