/**
 * B227B-DEV: Developer Services
 *
 * Services for module development, testing, and approval:
 * - ModuleScannerService: Vulnerability scanning
 * - AutomatedTestHarness: Test execution
 * - SignatureVerificationService: Digital signature verification
 * - MarketplaceApprovalPipeline: Approval workflow orchestration
 * - ModuleQualityScore: Quality metrics calculation
 */

export { ModuleScannerService, ScanReport, Vulnerability } from './security/moduleScanner';
export { AutomatedTestHarness, TestHarnessResult, TestSuite, CoverageMetrics } from './testing/testHarness';
export {
  SignatureVerificationService,
  SignatureVerificationResult,
  ModuleSignature,
} from './security/signatureVerification';
export { MarketplaceApprovalPipeline, PipelineHistory, PipelineStep } from './pipeline/approvalPipeline';
export { ModuleQualityScore, QualityMetrics } from './quality/moduleQualityScore';
