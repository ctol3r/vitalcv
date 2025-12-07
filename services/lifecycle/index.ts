/**
 * B207A-LIFE: Lifecycle Service
 *
 * Main exports for lifecycle service components
 */

// Models
export * from './models/LifecycleState.js';
export * from './models/CredentialExpiryPolicy.js';
export * from './models/RenewalRequest.js';
export * from './models/AutoRenewalRules.js';
export * from './models/Revocation.js';
export * from './models/RevocationReason.js';
export * from './models/CredentialFreeze.js';

// Constants
export * from './constants.js';

// Extractors
export * from './extractors/temporalFeatures.js';
export * from './extractors/eventSeries.js';

// Storage
export * from './storage.js';

// Services
export { RenewalService } from './renewalService.js';
export { RevocationService } from './revocationService.js';
export { ExpirationScheduler } from './schedulers/expirationScheduler.js';
export { RenewalNotificationService } from './notifications/renewalNotificationService.js';
export { RenewalPolicyService } from './policies/renewalPolicyService.js';
export { CredentialReplacementService } from './replacementService.js';
export { CredentialFreezeService } from './models/CredentialFreeze.js';

// Audit
export { RevocationAuditLogService } from './audit/revocationAuditLog.js';

// Notifications
export { RevocationNotificationService } from './notifications/revocationNotificationService.js';

// Workflows
export { RenewalApprovalWorkflowService } from './workflows/renewalApprovalWorkflow.js';

// Reports
export { ExpiringCredentialsReportService } from './reports/expiringCredentialsReport.js';

// API
export { createCredentialLifecycleRouter } from './api/credentialLifecycleAPI.js';

