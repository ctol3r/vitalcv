/**
 * B242A: Accessibility Services
 *
 * Central export point for all accessibility-related services, utilities, and models.
 */

// Models
export * from './models/AccessibilityPreference';
export * from './models/SemanticLabel';

// Services
export { accessibilitySettingsService, AccessibilitySettingsService } from './services/accessibilitySettingsService';
export { fontSizeScalingService, FontSizeScalingService } from './services/fontSizeScalingService';
export { semanticLabelService, SemanticLabelService } from './services/semanticLabelService';
export { screenReaderSupportHelper, ScreenReaderSupportHelper } from './services/screenReaderSupportHelper';

// Audit
export { wcagComplianceAuditService, WCAGComplianceAuditService } from './audit/wcagComplianceAuditService';
export type { WCAGAuditResult, WCAGViolation } from './audit/wcagComplianceAuditService';

// Utils
export * from './utils/contrastChecker';

// Validation
export { accessibleFormValidator, AccessibleFormValidator } from './validation/accessibleFormValidator';
export type { FormValidationResult, FormField } from './validation/accessibleFormValidator';

// Reports
export { accessibilityReportGenerator, AccessibilityReportGenerator } from './reports/accessibilityReportGenerator';
export type { AccessibilityReport, ReportSummary } from './reports/accessibilityReportGenerator';

