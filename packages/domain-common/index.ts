// Barrel export for package public API
export { DomainError } from './src/errors/DomainError';
export * from './credentialingContracts';
export {
  PRIVILEGE_CATEGORY_VALUES,
  PRIVILEGE_DEPENDENCY_TYPE_VALUES,
  type PrivilegeCategory,
  type PrivilegeDependencyEdge,
  type PrivilegeDependencyType,
  type EligibilitySeverity,
  type PrivilegeEligibilityFinding,
  type PrivilegeEligibilityResult,
  type PrivilegeNodeContract,
} from './privilegeContracts';
export {
  FPPE_STATUS_VALUES,
  OPPE_CASE_STATUS_VALUES,
  PROCEDURE_EVENT_SEVERITIES,
  type FPPERecord,
  type FPPEStatus,
  type OPPECaseMetrics,
  type OPPECaseRecord,
  type OPPECaseStatus,
  type ProcedureEvent,
  type ProcedureEventSeverity,
} from './qualityContracts';
export {
  type FacilityDepartmentDelegation,
  type FacilityPrivilegeCredential,
  type FacilityPrivilegeRevocation,
  type FacilityPrivilegeTemplateVersion,
  type FacilityIssuerType,
} from './facilityPrivilegeContracts';
export {
  FacilityPrivilegeViolation,
  assertFacilityPrivilegeTemplateValid,
  assertTemplateSupersessionValid,
  assertDelegationAllowsIssuance,
  assertFacilityPrivilegeIssuanceValid,
  assertFacilityPrivilegeScope,
} from './facilityPrivilegeGuards';
export {
  type RecognitionEvent,
  type EmployerAcceptance,
  type StartAttestation,
  type CanonicalPathEvent,
  type EmploymentVerificationPath,
  type VerifiedCanonicalPath,
  type EmploymentStartRequest,
  type CredentialIssuanceRequest,
} from './employmentContracts';
export {
  CanonicalPathViolation,
  assertRecognitionEventValid,
  assertEmployerAcceptanceValid,
  assertStartAttestationValid,
  assertCanonicalPathValid,
  isCanonicalPathValid,
  verifyCanonicalPath,
} from './employmentGuards';
export {
  PSVSource,
  PSV_SOURCE_VALUES,
  PSVStatus,
  PSV_STATUS_VALUES,
  PSVDecision,
  PSV_DECISION_VALUES,
  type PSVCheckEvidence,
  type PSVCheckResult,
  type PSVFinding,
  type PSVFreshnessRule,
  type PSVMatchingRule,
  type PSVPolicy,
  type PSVPolicyEvaluation,
  type PSVReport,
} from './psvContracts';
export {
  createPSVReport,
  evaluatePSV,
  getMissingRequiredSources,
  getStaleChecks,
  isCheckFresh,
} from './psvPolicy';
export {
  AUTHORITY_CREDENTIAL_STATUS_VALUES,
  AUTHORITY_CREDENTIAL_TYPE_VALUES,
  AUTHORITY_ISSUER_TYPES,
  type AuthorityAcceptanceEvent,
  type AuthorityCredential,
  type AuthorityCredentialStatus,
  type AuthorityCredentialType,
  type AuthorityEvent,
  type AuthorityFacility,
  type AuthorityIssuerType,
} from './src/authorityEvents';
export {
  type PubMedArticle,
  type PubMedSearchResult,
  type OrcidVerificationStatus,
  type OrcidAffiliation,
  type OrcidWork,
  type OrcidProfile,
  type ClinicalTrialRole,
  type ClinicalTrialPhase,
  type ClinicalTrialStatus,
  type ClinicalTrialRecord,
  type ClinicalTrialSearchResult,
  type ResearchActivityScore,
  type ResearchDisclosurePreferences,
} from './researchContracts';
