/**
 * W2-PR80A — Institutional Deployment Templates
 *
 * Core types for repeatable institutional deployment blueprints.
 *
 * Invariants:
 *  - DeploymentTemplate is immutable. Once a template ID + version is published,
 *    its fields are frozen. New behavior ships as a new version.
 *  - DeploymentPreset is the materialized form of (template + institution + env).
 *    Its presetHash MUST be deterministic — same inputs always produce the same hash.
 *  - DeploymentRolloutManifest is the on-disk record of an actual deployment.
 *    Manifests are append-only. Rollback emits a NEW manifest with rollbackOf set.
 *  - All ambiguity (TBD, unverified, opt-in) is preserved as explicit literal
 *    states — never silently coerced to a default.
 */

export const DEPLOYMENT_TEMPLATE_SCHEMA = 'https://vitalcv.com/deployment-template/v1';
export const DEPLOYMENT_PRESET_SCHEMA = 'https://vitalcv.com/deployment-preset/v1';
export const DEPLOYMENT_ROLLOUT_SCHEMA = 'https://vitalcv.com/deployment-rollout/v1';
export const DEPLOYMENT_ONBOARDING_SCHEMA = 'https://vitalcv.com/deployment-onboarding/v1';
export const DEPLOYMENT_BUNDLE_SCHEMA = 'https://vitalcv.com/deployment-policy-bundle/v1';

/** Coarse institutional role. Drives which templates are applicable. */
export const INSTITUTION_ROLES = [
  'health-system-issuer',
  'payer-verifier',
  'employer-verifier',
  'pilot-tenant',
  'multi-region-issuer',
] as const;
export type InstitutionRole = (typeof INSTITUTION_ROLES)[number];

/**
 * Posture states are explicit. `unverified-foundation` is a real state — it
 * means the surface is wired but not yet enforced in production. Templates
 * MUST NOT silently widen this to `enforced` on apply.
 */
export const POSTURE_STATES = [
  'enforced',
  'foundation-only',
  'unverified-foundation',
  'disabled',
] as const;
export type PostureState = (typeof POSTURE_STATES)[number];

/** Deployment environments are a closed set; presets are env-bound. */
export const DEPLOYMENT_ENVS = ['dev', 'pilot', 'staging', 'prod'] as const;
export type DeploymentEnv = (typeof DEPLOYMENT_ENVS)[number];

/** Trust-policy posture per surface. All fields are required so absence is detectable. */
export type TrustPolicyPosture = Readonly<{
  redaction: PostureState;
  retention: PostureState;
  authorityAdapters: PostureState;
  superadminGate: PostureState;
  complianceReport: PostureState;
}>;

/**
 * Required env-var NAMES (NOT values). Names in the manifest stabilize the
 * config-hash regardless of secret rotation.
 */
export type EnvVarRequirement = Readonly<{
  name: string;
  scope: DeploymentEnv | 'all';
  required: true;
  /** Why this var is required. Surfaces in onboarding-kit copy. */
  rationale: string;
}>;

export type FeatureFlagRequirement = Readonly<{
  name: string;
  /** Default state when applying this template. Operator may override. */
  defaultState: 'on' | 'off';
  /** Whether this flag is mandatory for the template's claims to hold. */
  loadBearing: boolean;
}>;

/**
 * A trust-policy bundle — the portable unit institutions deploy. Bundles are
 * composable: a template references one or more bundles by ID, and operators
 * extend never-mutate.
 */
export type TrustPolicyBundle = Readonly<{
  schema: typeof DEPLOYMENT_BUNDLE_SCHEMA;
  bundleId: string;
  bundleVersion: string;
  posture: TrustPolicyPosture;
  /** Audit event types this bundle's surfaces emit. Used for replay coverage. */
  auditEventCoverage: ReadonlyArray<string>;
  /** Disclaimer text — preserved verbatim in compliance evidence reports. */
  disclaimer: string;
}>;

export type DeploymentTemplate = Readonly<{
  schema: typeof DEPLOYMENT_TEMPLATE_SCHEMA;
  templateId: string;
  templateVersion: string;
  role: InstitutionRole;
  /** Human-readable description; not parsed by replay engine. */
  description: string;
  /** Bundles applied in order; later bundles MUST NOT relax earlier ones. */
  policyBundleIds: ReadonlyArray<string>;
  envVars: ReadonlyArray<EnvVarRequirement>;
  featureFlags: ReadonlyArray<FeatureFlagRequirement>;
  /** Tenant scope policy: single-tenant, federated, or pilot-isolated. */
  tenantScope: 'single' | 'federated' | 'pilot-isolated';
  /** Whether the template requires a real Codex SAFE verdict before apply. */
  requiresCodexSafe: boolean;
  /** Audit event emitted on apply. Templates MUST own their event coverage. */
  applyAuditEvent: string;
}>;

/**
 * Preset = template + institution + env, frozen to a hash. The hash is the
 * primary key for replay: given the same hash, the same preset MUST resolve to
 * the same materialized config.
 */
export type DeploymentPreset = Readonly<{
  schema: typeof DEPLOYMENT_PRESET_SCHEMA;
  presetId: string;
  presetHash: string; // sha256
  templateId: string;
  templateVersion: string;
  institutionId: string;
  env: DeploymentEnv;
  /** Bundle IDs resolved at preset-creation time. Frozen here for replay. */
  bundleIds: ReadonlyArray<string>;
  /** Env-var NAMES (NOT values) at preset-creation time. */
  envVarNames: ReadonlyArray<string>;
  /** Feature-flag NAMES + states at preset-creation time. */
  featureFlags: ReadonlyArray<{ name: string; state: 'on' | 'off' }>;
  /** Posture as resolved from bundle composition. */
  resolvedPosture: TrustPolicyPosture;
  /** ISO timestamp when this preset was frozen. */
  frozenAt: string;
}>;

/**
 * Manifest of an actual deployment rollout. One manifest per apply / rollback.
 * Manifests form a chain via previousManifestId.
 */
export type DeploymentRolloutManifest = Readonly<{
  schema: typeof DEPLOYMENT_ROLLOUT_SCHEMA;
  manifestId: string;
  presetHash: string;
  templateId: string;
  templateVersion: string;
  institutionId: string;
  env: DeploymentEnv;
  /** Operator identifier (CI actor or human ID). */
  operator: string;
  /** ISO timestamp of rollout. */
  rolloutAt: string;
  /** Git SHA of the code being deployed. */
  gitSha: string;
  /** Previous manifest in the chain, or null for genesis. */
  previousManifestId: string | null;
  /** If this is a rollback, the manifestId being rolled back. */
  rollbackOf: string | null;
  /** Codex SAFE verdict ID if the template required one; null for rollback. */
  codexSafeVerdictId: string | null;
  /** Chaos verdict fingerprint (sha256 of all chaos-mode results). */
  chaosFingerprint: string;
}>;

/**
 * Drift report — produced by re-deriving a preset from its frozen hash inputs
 * and comparing to current state.
 */
export const DRIFT_CODES = [
  'DRIFT-TEMPLATE-CLEAN',
  'DRIFT-TEMPLATE-VERSION-MISMATCH',
  'DRIFT-TEMPLATE-BUNDLE-CHANGED',
  'DRIFT-TEMPLATE-ENVVAR-DROPPED',
  'DRIFT-TEMPLATE-FLAG-CHANGED',
  'DRIFT-TEMPLATE-POSTURE-RELAXED',
  'DRIFT-TEMPLATE-MANIFEST-ORPHAN',
] as const;
export type DriftCode = (typeof DRIFT_CODES)[number];

export type DriftReport = Readonly<{
  presetHash: string;
  manifestId: string;
  driftCode: DriftCode;
  /** Specific fields that differ. Empty array iff CLEAN. */
  divergedFields: ReadonlyArray<string>;
  detectedAt: string;
}>;

/**
 * Onboarding kit — the artifacts handed to a new institution to apply a template.
 * Kits are deterministic given (templateId, templateVersion, env, institutionId).
 */
export type OnboardingKit = Readonly<{
  schema: typeof DEPLOYMENT_ONBOARDING_SCHEMA;
  kitId: string;
  templateId: string;
  templateVersion: string;
  institutionId: string;
  env: DeploymentEnv;
  /** Steps the institution operator MUST complete before apply. */
  preflightChecklist: ReadonlyArray<{ id: string; description: string; required: true }>;
  /** Required env-var names with rationale; values are operator-supplied. */
  envVars: ReadonlyArray<EnvVarRequirement>;
  /** Trust-policy bundle disclaimers, preserved verbatim. */
  disclaimers: ReadonlyArray<string>;
  /** Audit events the institution should expect post-apply. */
  expectedAuditEvents: ReadonlyArray<string>;
  /** Hash of the kit content; same kit → same hash. */
  kitHash: string;
}>;

/** Chaos modes for deployment-template integrity testing. */
export const TEMPLATE_CHAOS_MODES = [
  'C-TEMPLATE-FROZEN-FIELD-MUTATION',
  'C-TEMPLATE-BUNDLE-DOWNGRADE',
  'C-TEMPLATE-MANIFEST-ORPHAN',
  'C-TEMPLATE-PRESET-HASH-COLLISION',
  'C-TEMPLATE-POSTURE-WIDENING',
  'C-TEMPLATE-MISSING-CODEX-SAFE',
  'C-TEMPLATE-ENV-CROSS-APPLY',
] as const;
export type TemplateChaosMode = (typeof TEMPLATE_CHAOS_MODES)[number];

export type ChaosVerdict = Readonly<{
  mode: TemplateChaosMode;
  /** SAFE = chaos was correctly rejected (fail-closed worked). UNSAFE = leak. */
  verdict: 'SAFE' | 'UNSAFE';
  rationale: string;
}>;
