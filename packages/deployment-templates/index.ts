/**
 * W2-PR80A — @vitalcv/deployment-templates
 *
 * Repeatable institutional deployment blueprints.
 *
 * Public surface:
 *  - Template registry (immutable definitions)
 *  - Trust-policy bundle composition (with anti-relaxation invariant)
 *  - Replay-safe presets (deterministic hashing)
 *  - Rollout manifests + lineage reconstruction
 *  - Environment onboarding kits
 *  - Drift detection + chaos simulations
 */

export type {
  DeploymentTemplate,
  DeploymentPreset,
  DeploymentRolloutManifest,
  DeploymentEnv,
  DriftCode,
  DriftReport,
  EnvVarRequirement,
  FeatureFlagRequirement,
  InstitutionRole,
  OnboardingKit,
  PostureState,
  TemplateChaosMode,
  ChaosVerdict,
  TrustPolicyBundle,
  TrustPolicyPosture,
} from './types';

export {
  DEPLOYMENT_BUNDLE_SCHEMA,
  DEPLOYMENT_ONBOARDING_SCHEMA,
  DEPLOYMENT_PRESET_SCHEMA,
  DEPLOYMENT_ROLLOUT_SCHEMA,
  DEPLOYMENT_TEMPLATE_SCHEMA,
  DEPLOYMENT_ENVS,
  DRIFT_CODES,
  INSTITUTION_ROLES,
  POSTURE_STATES,
  TEMPLATE_CHAOS_MODES,
} from './types';

export {
  HEALTH_SYSTEM_ISSUER_V1,
  PAYER_VERIFIER_V1,
  PILOT_TENANT_V1,
  MULTI_REGION_ISSUER_V1,
  getTemplate,
  listTemplates,
  listTemplatesByRole,
} from './templates';

export {
  FOUNDATION_BUNDLE,
  ISSUER_BUNDLE,
  VERIFIER_BUNDLE,
  PILOT_BUNDLE,
  PRODUCTION_HARDENED_BUNDLE,
  composeBundles,
  getBundle,
  listBundles,
} from './policyBundles';

export {
  computePresetHash,
  freezePreset,
  stableStringify,
  verifyPresetHash,
  type FreezePresetInput,
} from './presets';

export {
  emitRolloutManifest,
  reconstructLineage,
  type EmitRolloutInput,
  type LineageReconstruction,
} from './rolloutLineage';

export {
  generateOnboardingKit,
  verifyOnboardingKit,
} from './onboarding';

export { detectDrift, summarizeDrift, type DriftCheckInput } from './drift';

export { runDeploymentChaos } from './chaos';
