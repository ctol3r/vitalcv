/**
 * @vitalcv/state-agent
 *
 * System intelligence generator & AI onboarding module for VitalCV.
 * Generates comprehensive state reports for new AI agents to understand
 * the system architecture, active modules, and current state.
 */

export { generateStateReport, type StateReportOptions } from './stateAgent';
export { scanMonorepo } from './scanners/monorepo';
export { scanApiRoutes } from './scanners/apiRoutes';
export { scanSubstratePallets } from './scanners/substrate';
export { collectCredentialRegistry } from './collectors/credentialRegistry';
export { collectAuditScrapbook } from './collectors/auditScrapbook';
export { collectOidcConfigs } from './collectors/oidc';
export { collectFhirResources } from './collectors/fhir';
export { collectPsvSources } from './collectors/psv';
export { collectMatchingEngines } from './collectors/matching';
export { collectSanctionsGraph } from './collectors/sanctions';
export { redactPiiPhi } from './compliance/redaction';
export { formatAsMarkdown } from './formatters/markdown';
export { formatAsJson } from './formatters/json';
export { generateNarrative } from './narrative/generator';
export { saveSnapshotToDatabase, loadSnapshotFromDatabase, listSnapshots, compareSnapshots } from './archival/snapshot';
export type { StateReport, SystemMetadata, ComplianceMetadata } from './types';

