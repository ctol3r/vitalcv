/**
 * types.ts — Canonical VCV Entity-Role-Relationship Model
 *
 * This file is the single source of truth for how VCV models the world.
 * Every service, route, and UI surface should derive its understanding
 * of entities, roles, and relationships from these types.
 *
 * Design principles:
 *   1. Entities exist independently of VCV user accounts.
 *      A clinician exists because NPPES says they exist — not because
 *      they signed up. An issuer exists because a claim references them.
 *   2. Roles are contextual and time-bounded, not fixed properties.
 *      A person can be a clinician in one context, a trainee in another.
 *   3. Relationships are evidence-backed. Every relationship should
 *      be traceable to an artifact or claim.
 *   4. NPI type is a routing signal, not a role assignment.
 *      Type 1 → subject is a person. Type 2 → subject is an organization.
 *      Either may hold multiple roles.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WAVE E1 — ENTITY TYPES
 * ═══════════════════════════════════════════════════════════════════════
 */

// ── Entity Types ──────────────────────────────────────────────────────────────

/**
 * The fundamental categories of entity VCV can track.
 * Entities are independent of VCV user accounts.
 */
export type EntityType =
  | 'person'                 // A human being. Usually a Type 1 NPI holder.
  | 'organization'           // A legal entity: hospital, group practice, staffing agency.
  | 'facility'               // A physical care delivery location.
  | 'educational_institution'// Medical school, university, nursing school.
  | 'training_program'       // Residency, fellowship, CME program, internship.
  | 'issuer_authority'       // State medical board, ABMS, DEA, NPDB, USMLE.
  | 'source_record';         // An official system of record entry (NPPES, OIG, PECOS).

/**
 * Canonical entity record — the VCV representation of a real-world entity.
 * Persisted in VcvEntity table. Resolved from source artifacts.
 */
export interface CanonicalEntity {
  id:           string;         // UUID
  entityType:   EntityType;
  canonicalId:  string;         // deterministic: sha256(entityType + primaryKey)
  displayName:  string;
  npi?:         string;         // if NPI-registered
  npiType?:     NpiType;
  orgDid?:      string;         // if DID-registered
  sourceIds:    string[];       // source systems that reference this entity
  verifiedAt?:  string;         // ISO — when identity last confirmed from source
  metadata:     EntityMetadata;
  createdAt:    string;
  updatedAt:    string;
}

export interface EntityMetadata {
  // Person-specific
  firstName?:       string;
  lastName?:        string;
  credential?:      string;      // MD, DO, NP, PA, RN, etc.
  gender?:          string;
  // Organization-specific
  orgName?:         string;
  facilityType?:    string;
  accreditation?:   string;
  // Education-specific
  acgmeCode?:       string;      // for residency programs
  lcmeStatus?:      string;      // for medical schools
  // Authority-specific
  jurisdictions?:   string[];    // states where authority operates
  credentialTypes?: string[];    // types of credentials this authority issues
  // Common
  addresses?:       EntityAddress[];
  taxonomies?:      EntityTaxonomy[];
}

export interface EntityAddress {
  type:    'MAILING' | 'PRACTICE' | 'HEADQUARTERS';
  line1:   string;
  city:    string;
  state:   string;
  zip:     string;
  country: string;
}

export interface EntityTaxonomy {
  code:    string;
  desc:    string;
  state?:  string;
  license?: string;
  primary: boolean;
}

// ── NPI Type ──────────────────────────────────────────────────────────────────

/**
 * NPI enumeration type — used for initial subject resolution and workflow routing.
 * This is a routing signal, not a role assignment.
 *   TYPE_1 → Individual provider → person entity → clinician-first workflow
 *   TYPE_2 → Organizational provider → organization entity → employer/issuer workflow
 */
export type NpiType = 'TYPE_1' | 'TYPE_2';

/**
 * Result of resolving an NPI to an entity type and initial role suggestions.
 */
export interface NpiResolution {
  npi:             string;
  npiType:         NpiType;
  enumerationType: 'NPI-1' | 'NPI-2';
  entityType:      EntityType;             // person or organization
  suggestedRoles:  RoleType[];             // initial role suggestions based on NPI type
  routingContext:  WorkflowContext;        // initial workflow context
  displayName:     string;
  specialty?:      string;
  status:          'ACTIVE' | 'DEACTIVATED' | 'UNKNOWN';
  source:          'NPPES_API' | 'CACHED';
  resolvedAt:      string;                 // ISO
  /** S3: canonical routing decision for UI/API consumers */
  routingDecision?: {
    workflowEntry:  string;
    subjectLabel:   string;
    confidence:     'HIGH' | 'MEDIUM' | 'LOW';
    warning?:       string;
  };
}

// ═══════════════════════════════════════════════════════════════════════
// WAVE E1 — ROLE TYPES
// ═══════════════════════════════════════════════════════════════════════

/**
 * Roles an entity can play. Roles are contextual and time-bounded.
 * A single entity can hold multiple roles simultaneously.
 *
 * person roles:       clinician, trainee, sponsor, admin_reviewer, coordinator
 * organization roles: employer, verifier, issuer, sponsor, coordinator
 * authority roles:    issuer, verifier
 */
export type RoleType =
  | 'clinician'       // Delivers clinical care. Requires: license, NPI-1.
  | 'employer'        // Employs clinicians. Hires, credentializes, onboards.
  | 'verifier'        // Reviews and accepts credential claims. Run by employer/payer/health plan.
  | 'issuer'          // Issues credentials: state board, ABMS, DEA, accreditor.
  | 'coordinator'     // Manages credentialing process on behalf of clinician or org.
  | 'sponsor'         // Sponsors privileges, training, or enrollment.
  | 'trainee'         // Undergoing supervised training (residency, fellowship, CME).
  | 'admin_reviewer'; // Manual review role: human in the loop for trust decisions.

/**
 * A time-bounded role assignment for an entity.
 */
export interface EntityRole {
  id:          string;
  entityId:    string;
  roleType:    RoleType;
  context?:    string;      // e.g., state of practice, specialty, program name
  validFrom?:  string;      // ISO
  validUntil?: string;      // ISO — null = currently active
  source:      RoleSource;  // how this role was assigned
  evidenceId?: string;      // artifact or claim ID backing this role
  createdAt:   string;
}

export type RoleSource =
  | 'NPPES_DERIVED'     // derived from NPPES taxonomy
  | 'USER_CLAIMED'      // asserted by the user
  | 'CLAIM_DERIVED'     // derived from an ingested claim
  | 'ADMIN_ASSIGNED'    // assigned by an administrator
  | 'INFERRED';         // inferred from context (lower confidence)

/**
 * Rules for role eligibility by entity type.
 */
export const ROLE_ELIGIBILITY: Record<RoleType, EntityType[]> = {
  clinician:      ['person'],
  employer:       ['organization', 'facility'],
  verifier:       ['organization', 'person'],
  issuer:         ['issuer_authority', 'organization', 'educational_institution'],
  coordinator:    ['person', 'organization'],
  sponsor:        ['organization', 'facility', 'educational_institution', 'training_program'],
  trainee:        ['person'],
  admin_reviewer: ['person'],
};

// ═══════════════════════════════════════════════════════════════════════
// WAVE E3 — RELATIONSHIP MODEL
// ═══════════════════════════════════════════════════════════════════════

/**
 * Typed relationships between entities.
 * Every relationship has a subject (who) and an object (to whom/what).
 * Relationships are directional: subject → [relationship] → object.
 */
export type RelationshipType =
  // Employment & affiliation
  | 'works_for'           // person → organization     (current employment)
  | 'employed_by'         // person → organization     (formal employment, may differ from works_for)
  | 'affiliated_with'     // person|org → organization (looser affiliation: staff, contractor)
  | 'privileges_at'       // person → facility         (clinical privileges granted)
  | 'enrolled_with'       // person → organization     (Medicare/Medicaid enrollment)

  // Training & education
  | 'trained_at'          // person → training_program|educational_institution
  | 'graduated_from'      // person → educational_institution
  | 'completed_residency_at'  // person → training_program
  | 'completed_fellowship_at' // person → training_program
  | 'sponsors'            // organization → training_program|person (sponsoring)

  // Credential chain
  | 'licensed_by'         // person → issuer_authority (license issued by)
  | 'certified_by'        // person → issuer_authority (board cert by)
  | 'registered_with'     // person → issuer_authority (DEA registration)
  | 'issues'              // issuer_authority → credential_type (can issue)
  | 'verifies'            // verifier → claim|entity   (has verified)

  // Trust transmission
  | 'requests_from'       // verifier → clinician      (credential request)
  | 'shares_with';        // clinician → verifier|employer (share bundle)

/**
 * The trust triangle — the three-party relationship at the core of VCV:
 *   issuer → [issued_credential] → clinician → [shared_bundle] → employer
 *
 * This is the canonical trust transmission path.
 */
export interface TrustTriangle {
  issuer:    { entityId: string; entityType: EntityType; name: string };
  clinician: { entityId: string; npi: string; name: string };
  employer:  { entityId: string; entityType: EntityType; name: string };
  // The artifact chain that connects them
  artifactIds: string[];
  claimIds:    string[];
  shareEventId?: string;
  resolvedAt:  string;
}

/**
 * A typed relationship between two entities.
 */
export interface EntityRelationship {
  id:               string;
  subjectId:        string;
  subjectType:      EntityType;
  objectId:         string;
  objectType:       EntityType;
  relationshipType: RelationshipType;
  // Contextual metadata
  state?:           string;    // state of license, practice location
  startDate?:       string;    // ISO
  endDate?:         string;    // ISO — null = current
  // Evidence
  artifactId?:      string;    // source artifact backing this relationship
  claimId?:         string;    // specific claim backing this relationship
  confidence:       number;    // 0.0–1.0
  tier:             'GOLD' | 'SILVER' | 'BRONZE';
  createdAt:        string;
}

/**
 * Allowed subject → relationship → object combinations.
 * Enforced by entityService before persisting relationships.
 */
export const RELATIONSHIP_RULES: Array<{
  subject: EntityType[];
  relationship: RelationshipType;
  object: EntityType[];
}> = [
  { subject: ['person'],          relationship: 'works_for',              object: ['organization', 'facility'] },
  { subject: ['person'],          relationship: 'employed_by',            object: ['organization', 'facility'] },
  { subject: ['person', 'organization'], relationship: 'affiliated_with', object: ['organization', 'facility', 'educational_institution'] },
  { subject: ['person'],          relationship: 'privileges_at',          object: ['facility', 'organization'] },
  { subject: ['person'],          relationship: 'enrolled_with',          object: ['organization'] },
  { subject: ['person'],          relationship: 'trained_at',             object: ['training_program', 'educational_institution'] },
  { subject: ['person'],          relationship: 'graduated_from',         object: ['educational_institution'] },
  { subject: ['person'],          relationship: 'completed_residency_at', object: ['training_program'] },
  { subject: ['person'],          relationship: 'completed_fellowship_at',object: ['training_program'] },
  { subject: ['organization', 'facility', 'educational_institution'], relationship: 'sponsors', object: ['training_program', 'person'] },
  { subject: ['person'],          relationship: 'licensed_by',            object: ['issuer_authority'] },
  { subject: ['person'],          relationship: 'certified_by',           object: ['issuer_authority'] },
  { subject: ['person'],          relationship: 'registered_with',        object: ['issuer_authority'] },
  { subject: ['issuer_authority'],'relationship': 'issues',               object: ['person'] },
  { subject: ['organization', 'person'], relationship: 'verifies',        object: ['person'] },
  { subject: ['organization', 'person'], relationship: 'requests_from',   object: ['person'] },
  { subject: ['person'],          relationship: 'shares_with',            object: ['organization', 'person'] },
];

// ═══════════════════════════════════════════════════════════════════════
// WAVE E4 — EDUCATION / TRAINING DOMAIN
// ═══════════════════════════════════════════════════════════════════════

/**
 * Education and training claim types.
 * These extend the ClaimType union in sourceCatalog.ts.
 * Listed here as the canonical definition; wire into sourceCatalog when ready.
 */
export type EducationClaimType =
  | 'MEDICAL_DEGREE'           // MD, DO, MBBS, etc.
  | 'NURSING_DEGREE'           // BSN, MSN, DNP, etc.
  | 'ADVANCED_PRACTICE_CERT'   // NP, PA, CRNA certification
  | 'RESIDENCY_COMPLETION'     // ACGME-accredited residency
  | 'FELLOWSHIP_COMPLETION'    // subspecialty fellowship
  | 'INTERNSHIP_COMPLETION'    // PGY-1 internship
  | 'CME_COMPLETION'           // continuing medical education
  | 'TRAINING_PROGRAM_STATUS'  // current training status (active trainee)
  | 'CLINICAL_ROTATION';       // student clinical rotation

/**
 * Education claim value — the structured content of an education claim.
 */
export interface MedicalDegreeValue {
  _type:           'MEDICAL_DEGREE';
  degreeType:      'MD' | 'DO' | 'MBBS' | 'MBChB' | 'MD_PHD' | 'OTHER';
  institution:     string;
  institutionId?:  string;     // VcvEntity ID if institution is registered
  graduationYear:  number | null;
  lcmeAccredited:  boolean | null;
  countryCode:     string;
}

export interface ResidencyValue {
  _type:       'RESIDENCY_COMPLETION';
  programName: string;
  specialty:   string;
  acgmeCode?:  string;
  hospital:    string;
  startYear:   number | null;
  endYear:     number | null;
  graduated:   boolean;
  pgLevel?:    string;         // PGY-1, PGY-2, etc.
}

export interface FellowshipValue {
  _type:       'FELLOWSHIP_COMPLETION';
  programName: string;
  specialty:   string;
  subspecialty?: string;
  hospital:    string;
  startYear:   number | null;
  endYear:     number | null;
  completed:   boolean;
  acgmeAccredited: boolean | null;
}

export interface TrainingProgramStatusValue {
  _type:        'TRAINING_PROGRAM_STATUS';
  programType:  'RESIDENCY' | 'FELLOWSHIP' | 'INTERNSHIP' | 'CME' | 'OTHER';
  programName:  string;
  currentPgLevel?: string;
  status:       'ACTIVE' | 'COMPLETED' | 'WITHDRAWN' | 'ON_LEAVE';
  expectedEndDate?: string;
}

/**
 * Education issuers — entities that can issue education claims.
 * These are registered as issuer_authority entities.
 */
export const EDUCATION_ISSUERS = {
  ACGME: {
    id:   'authority:acgme',
    name: 'Accreditation Council for Graduate Medical Education',
    type: 'issuer_authority' as EntityType,
    credentialTypes: ['RESIDENCY_COMPLETION', 'FELLOWSHIP_COMPLETION'],
  },
  LCME: {
    id:   'authority:lcme',
    name: 'Liaison Committee on Medical Education',
    type: 'issuer_authority' as EntityType,
    credentialTypes: ['MEDICAL_DEGREE'],
  },
  AOA: {
    id:   'authority:aoa',
    name: 'American Osteopathic Association',
    type: 'issuer_authority' as EntityType,
    credentialTypes: ['MEDICAL_DEGREE', 'RESIDENCY_COMPLETION'],
  },
  CCME: {
    id:   'authority:ccme',
    name: 'Accreditation Council for Continuing Medical Education',
    type: 'issuer_authority' as EntityType,
    credentialTypes: ['CME_COMPLETION'],
  },
} as const;

/**
 * Readiness implications of education claim presence/absence.
 * Used by trustStateEngine when computing readiness from education claims.
 */
export const EDUCATION_READINESS_RULES: Array<{
  claimType:    EducationClaimType;
  required:     boolean;
  freshnessWindowDays: number | null;  // null = permanent once issued
  blockingIfMissing: boolean;
  blockingIfExpired: boolean;
}> = [
  { claimType: 'MEDICAL_DEGREE',          required: true,  freshnessWindowDays: null, blockingIfMissing: true,  blockingIfExpired: false },
  { claimType: 'RESIDENCY_COMPLETION',    required: false, freshnessWindowDays: null, blockingIfMissing: false, blockingIfExpired: false },
  { claimType: 'FELLOWSHIP_COMPLETION',   required: false, freshnessWindowDays: null, blockingIfMissing: false, blockingIfExpired: false },
  { claimType: 'TRAINING_PROGRAM_STATUS', required: false, freshnessWindowDays: 90,   blockingIfMissing: false, blockingIfExpired: false },
  { claimType: 'CME_COMPLETION',          required: false, freshnessWindowDays: 365,  blockingIfMissing: false, blockingIfExpired: false },
];

// ═══════════════════════════════════════════════════════════════════════
// WAVE E2 — NPI TYPE BRANCHING RULES
// ═══════════════════════════════════════════════════════════════════════

/**
 * Routing rules based on NPI type.
 * These govern how the system initialises entity resolution,
 * assigns initial roles, and routes to the appropriate workflow.
 */
export interface NpiTypeRoutingRule {
  npiType:           NpiType;
  enumerationType:   'NPI-1' | 'NPI-2';
  entityType:        EntityType;
  primaryRoles:      RoleType[];
  workflowContext:   WorkflowContext;
  subjectLabel:      string;           // human-readable: "Individual Provider" / "Organization"
  identityAnchor:    'PERSON_NAME' | 'ORG_NAME'; // how to resolve display identity
  requiresUserLink:  boolean;          // does this entity require a VCV user account?
}

export const NPI_TYPE_ROUTING: Record<NpiType, NpiTypeRoutingRule> = {
  TYPE_1: {
    npiType:          'TYPE_1',
    enumerationType:  'NPI-1',
    entityType:       'person',
    primaryRoles:     ['clinician'],
    workflowContext:  'prove_readiness',
    subjectLabel:     'Individual Provider',
    identityAnchor:   'PERSON_NAME',
    requiresUserLink: false,
  },
  TYPE_2: {
    npiType:          'TYPE_2',
    enumerationType:  'NPI-2',
    entityType:       'organization',
    primaryRoles:     ['employer', 'verifier'],
    workflowContext:  'review_clinician',
    subjectLabel:     'Organization / Group Practice',
    identityAnchor:   'ORG_NAME',
    requiresUserLink: false,
  },
};

// ═══════════════════════════════════════════════════════════════════════
// WAVE E5 — WORKFLOW CONTEXT MODEL
// ═══════════════════════════════════════════════════════════════════════

/**
 * Workflow contexts — the task the user is trying to accomplish.
 * Contexts drive UI routing, API behavior, and permission gates.
 * A context is NOT the same as a role — it's the intent of the current session.
 *
 * Design rule: one context at a time. No nested contexts.
 */
export type WorkflowContext =
  | 'prove_readiness'        // Clinician proving credentials to employer.
  | 'review_clinician'       // Employer/verifier reviewing clinician credentials.
  | 'issue_credential'       // Issuer confirming or issuing a credential.
  | 'monitor_standing'       // Ongoing monitoring of a clinician's credential status.
  | 'evaluate_organization'  // Reviewing an organization's credential management.
  | 'manage_training'        // Managing/administering a training program.
  | 'request_verification'   // Requesting verification from an external source.
  | 'inspect_lineage';       // Developer/auditor inspecting claim/artifact lineage.

/**
 * A resolved workflow context includes the entity and the permitted actions.
 */
export interface ResolvedWorkflowContext {
  context:         WorkflowContext;
  actorEntityId:   string;
  actorEntityType: EntityType;
  actorRoles:      RoleType[];
  // What actions the actor can take in this context
  permittedActions: WorkflowAction[];
  // What surfaces/routes are appropriate
  primarySurface:  WorkflowSurface;
  fallbackSurface: WorkflowSurface;
}

export type WorkflowAction =
  | 'submit_npi'
  | 'view_readiness'
  | 'share_bundle'
  | 'view_claims'
  | 'view_receipts'
  | 'view_lineage'
  | 'accept_bundle'
  | 'flag_for_review'
  | 'issue_credential'
  | 'revoke_credential'
  | 'add_training_record'
  | 'enroll_provider';

export type WorkflowSurface =
  | '/get-ready'
  | '/interview'
  | '/passport'
  | '/holder'
  | '/verifier'
  | '/verifier/inbox'
  | '/explore'
  | '/employers'
  | '/docs'
  | '/calibration';

/**
 * Context routing table — maps context + role to surfaces and actions.
 */
export const WORKFLOW_ROUTING: Record<WorkflowContext, {
  suggestedRoles:   RoleType[];
  permittedActions: WorkflowAction[];
  primarySurface:   WorkflowSurface;
  fallbackSurface:  WorkflowSurface;
  description:      string;
}> = {
  prove_readiness: {
    suggestedRoles:   ['clinician'],
    permittedActions: ['submit_npi', 'view_readiness', 'share_bundle', 'view_claims'],
    primarySurface:   '/get-ready',
    fallbackSurface:  '/interview',
    description:      'Clinician demonstrates credential readiness to an employer or verifier.',
  },
  review_clinician: {
    suggestedRoles:   ['employer', 'verifier'],
    permittedActions: ['view_readiness', 'view_claims', 'view_receipts', 'accept_bundle', 'flag_for_review'],
    primarySurface:   '/verifier/inbox',
    fallbackSurface:  '/verifier',
    description:      'Employer or verifier reviews and accepts clinician credential claims.',
  },
  issue_credential: {
    suggestedRoles:   ['issuer'],
    permittedActions: ['issue_credential', 'revoke_credential', 'view_claims'],
    primarySurface:   '/verifier',
    fallbackSurface:  '/docs',
    description:      'Issuing authority confirms or issues a credential.',
  },
  monitor_standing: {
    suggestedRoles:   ['employer', 'verifier', 'clinician'],
    permittedActions: ['view_readiness', 'view_claims', 'flag_for_review'],
    primarySurface:   '/verifier/inbox',
    fallbackSurface:  '/passport',
    description:      'Continuous monitoring of a provider\'s credential standing.',
  },
  evaluate_organization: {
    suggestedRoles:   ['admin_reviewer'],
    permittedActions: ['view_readiness', 'view_claims', 'view_lineage', 'flag_for_review'],
    primarySurface:   '/verifier',
    fallbackSurface:  '/docs',
    description:      'Reviewing an organization\'s credential management practices.',
  },
  manage_training: {
    suggestedRoles:   ['coordinator', 'sponsor'],
    permittedActions: ['add_training_record', 'view_readiness', 'enroll_provider'],
    primarySurface:   '/verifier',
    fallbackSurface:  '/employers',
    description:      'Managing a training program and its participants.',
  },
  request_verification: {
    suggestedRoles:   ['employer', 'verifier'],
    permittedActions: ['submit_npi', 'view_readiness', 'view_claims', 'view_receipts'],
    primarySurface:   '/verifier/inbox',
    fallbackSurface:  '/explore',
    description:      'Requesting verification of a credential from an external source.',
  },
  inspect_lineage: {
    suggestedRoles:   ['admin_reviewer'],
    permittedActions: ['view_claims', 'view_receipts', 'view_lineage'],
    primarySurface:   '/calibration',
    fallbackSurface:  '/docs',
    description:      'Developer or auditor inspecting claim and artifact lineage.',
  },
};

// ═══════════════════════════════════════════════════════════════════════
// ENTITY COMBINATION RULES — multi-role entities
// ═══════════════════════════════════════════════════════════════════════

/**
 * Mixed-role entity patterns. These are the combinations the product must support.
 * Each pattern has a canonical label and the workflow contexts it activates.
 */
export interface EntityRolePattern {
  label:         string;
  roles:         RoleType[];
  entityTypes:   EntityType[];
  contexts:      WorkflowContext[];
  description:   string;
}

export const ENTITY_ROLE_PATTERNS: EntityRolePattern[] = [
  {
    label:       'clinician',
    roles:       ['clinician'],
    entityTypes: ['person'],
    contexts:    ['prove_readiness', 'monitor_standing'],
    description: 'Individual provider seeking or maintaining credentialing.',
  },
  {
    label:       'employer',
    roles:       ['employer', 'verifier'],
    entityTypes: ['organization', 'facility'],
    contexts:    ['review_clinician', 'monitor_standing', 'request_verification'],
    description: 'Organization that employs and credentials clinicians.',
  },
  {
    label:       'issuer',
    roles:       ['issuer'],
    entityTypes: ['issuer_authority'],
    contexts:    ['issue_credential'],
    description: 'Credentialing authority that issues and revokes credentials.',
  },
  {
    label:       'clinician_employer',
    roles:       ['clinician', 'employer'],
    entityTypes: ['person', 'organization'],
    contexts:    ['prove_readiness', 'review_clinician', 'monitor_standing'],
    description: 'Provider who also employs other providers (e.g., physician group owner).',
  },
  {
    label:       'clinician_employer_issuer',
    roles:       ['clinician', 'employer', 'issuer'],
    entityTypes: ['person', 'organization', 'issuer_authority'],
    contexts:    ['prove_readiness', 'review_clinician', 'issue_credential', 'monitor_standing'],
    description: 'Full stack: delivers care, employs others, and issues credentials.',
  },
  {
    label:       'trainee',
    roles:       ['trainee', 'clinician'],
    entityTypes: ['person'],
    contexts:    ['prove_readiness', 'manage_training'],
    description: 'Provider in active training (residency, fellowship).',
  },
  {
    label:       'coordinator',
    roles:       ['coordinator'],
    entityTypes: ['person', 'organization'],
    contexts:    ['request_verification', 'manage_training'],
    description: 'Credentialing coordinator managing the process for clinicians or orgs.',
  },
];

// ═══════════════════════════════════════════════════════════════════════
// CANONICAL ISSUER AUTHORITIES
// ═══════════════════════════════════════════════════════════════════════

/**
 * Well-known issuer authorities.
 * These are registered as issuer_authority entities at system startup.
 * They appear in claims, relationships, and trust triangles.
 */
export const CANONICAL_ISSUERS = {
  // Federal
  CMS_NPPES:   { id: 'authority:cms:nppes',   name: 'CMS National Plan & Provider Enumeration System', jurisdiction: 'FEDERAL' },
  OIG_LEIE:    { id: 'authority:oig:leie',    name: 'HHS Office of Inspector General — LEIE',          jurisdiction: 'FEDERAL' },
  CMS_PECOS:   { id: 'authority:cms:pecos',   name: 'CMS Provider Enrollment, Chain, and Ownership System', jurisdiction: 'FEDERAL' },
  DEA:         { id: 'authority:dea',         name: 'Drug Enforcement Administration',                 jurisdiction: 'FEDERAL' },
  NPDB:        { id: 'authority:npdb',        name: 'National Practitioner Data Bank',                 jurisdiction: 'FEDERAL' },
  SAM_GOV:     { id: 'authority:sam',         name: 'System for Award Management (SAM.gov)',            jurisdiction: 'FEDERAL' },
  // Boards
  ABMS:        { id: 'authority:abms',        name: 'American Board of Medical Specialties',           jurisdiction: 'NATIONAL' },
  AOA_BOARDS:  { id: 'authority:aoa-boards',  name: 'American Osteopathic Association Boards',         jurisdiction: 'NATIONAL' },
  // Licensure databases
  NURSYS:      { id: 'authority:nursys',      name: 'Nursys Nurse Licensure System',                   jurisdiction: 'NATIONAL' },
  // Education
  ACGME:       { id: 'authority:acgme',       name: 'Accreditation Council for Graduate Medical Education', jurisdiction: 'NATIONAL' },
  LCME:        { id: 'authority:lcme',        name: 'Liaison Committee on Medical Education',          jurisdiction: 'NATIONAL' },
} as const;

export type CanonicalIssuerId = keyof typeof CANONICAL_ISSUERS;
