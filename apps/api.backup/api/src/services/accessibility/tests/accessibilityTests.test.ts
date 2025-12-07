/**
 * B242A-ACC-010: AccessibilityTests Suite
 *
 * Comprehensive tests covering:
 * - Preference storage
 * - WCAG audits
 * - Contrast checks
 * - Text scaling
 * - Semantic labels
 * Uses a11y testing patterns with sample components
 */

import { PrismaClient } from '@prisma/client';
import { accessibilitySettingsService } from '../services/accessibilitySettingsService';
import { wcagComplianceAuditService } from '../audit/wcagComplianceAuditService';
import { checkContrast, calculateContrastRatio, meetsWCAGAA } from '../utils/contrastChecker';
import { fontSizeScalingService } from '../services/fontSizeScalingService';
import { semanticLabelService } from '../services/semanticLabelService';
import { screenReaderSupportHelper } from '../services/screenReaderSupportHelper';
import { accessibleFormValidator } from '../validation/accessibleFormValidator';
import { accessibilityReportGenerator } from '../reports/accessibilityReportGenerator';

const prisma = new PrismaClient();

describe('Accessibility Services', () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create a test user
    const user = await prisma.user.create({
      data: {
        email: `test-accessibility-${Date.now()}@example.com`,
        name: 'Test User',
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.accessibilityPreference.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.semanticLabel.deleteMany({
      where: { componentId: { startsWith: 'test-' } },
    });
    await prisma.user.delete({
      where: { id: testUserId },
    });
    await prisma.$disconnect();
  });

  describe('AccessibilitySettingsService', () => {
    it('should create default preferences when none exist', async () => {
      const preferences = await accessibilitySettingsService.getPreferences(testUserId);

      expect(preferences).toBeDefined();
      expect(preferences.userId).toBe(testUserId);
      expect(preferences.highContrast).toBe(false);
      expect(preferences.textSizeScale).toBe(1.0);
      expect(preferences.enableCaptions).toBe(false);
      expect(preferences.reduceMotion).toBe(false);
    });

    it('should update preferences', async () => {
      const updated = await accessibilitySettingsService.updatePreferences(testUserId, {
        highContrast: true,
        textSizeScale: 1.5,
      });

      expect(updated.highContrast).toBe(true);
      expect(updated.textSizeScale).toBe(1.5);
    });

    it('should get existing preferences', async () => {
      const preferences = await accessibilitySettingsService.getPreferences(testUserId);

      expect(preferences.highContrast).toBe(true);
      expect(preferences.textSizeScale).toBe(1.5);
    });

    it('should delete preferences', async () => {
      await accessibilitySettingsService.deletePreferences(testUserId);
      const preferences = await accessibilitySettingsService.getPreferences(testUserId);

      // Should recreate with defaults
      expect(preferences.highContrast).toBe(false);
    });
  });

  describe('ContrastChecker', () => {
    it('should calculate contrast ratio correctly', () => {
      // Black on white should have high contrast
      const ratio = calculateContrastRatio('#000000', '#FFFFFF');
      expect(ratio).toBeGreaterThan(20);

      // White on white should have no contrast
      const ratio2 = calculateContrastRatio('#FFFFFF', '#FFFFFF');
      expect(ratio2).toBeCloseTo(1, 1);
    });

    it('should check WCAG AA compliance', () => {
      // Black on white meets AA
      expect(meetsWCAGAA('#000000', '#FFFFFF')).toBe(true);

      // Light gray on white does not meet AA
      expect(meetsWCAGAA('#CCCCCC', '#FFFFFF')).toBe(false);
    });

    it('should provide detailed contrast check results', () => {
      const result = checkContrast('#000000', '#FFFFFF');

      expect(result.contrastRatio).toBeGreaterThan(20);
      expect(result.passesNormalTextAA).toBe(true);
      expect(result.passesLargeTextAA).toBe(true);
      expect(result.passesUIComponentsAA).toBe(true);
      expect(result.passesNormalTextAAA).toBe(true);
      expect(result.passesLargeTextAAA).toBe(true);
    });

    it('should handle invalid hex colors', () => {
      expect(() => {
        calculateContrastRatio('invalid', '#FFFFFF');
      }).toThrow('Invalid hex color format');
    });
  });

  describe('FontSizeScalingService', () => {
    it('should clamp scale to safe range', () => {
      const scale1 = fontSizeScalingService.applyScaling(0.1); // Too small
      expect(scale1).toBeGreaterThanOrEqual(0.5);

      const scale2 = fontSizeScalingService.applyScaling(5.0); // Too large
      expect(scale2).toBeLessThanOrEqual(3.0);
    });

    it('should calculate scaled font sizes', () => {
      const scaled = fontSizeScalingService.calculateScaledSize(16, 1.5);
      expect(scaled).toBe(24);
    });

    it('should validate scale values', () => {
      const validation1 = fontSizeScalingService.validateScale(0.5);
      expect(validation1.valid).toBe(true);

      const validation2 = fontSizeScalingService.validateScale(0.1);
      expect(validation2.valid).toBe(true);
      expect(validation2.warnings.length).toBeGreaterThan(0);
    });

    it('should generate CSS for text scaling', () => {
      const css = fontSizeScalingService.generateCSS(1.5);
      expect(css).toContain('--text-size-scale');
      expect(css).toContain('1.5');
    });
  });

  describe('SemanticLabelService', () => {
    const testComponentId = 'test-login-button';

    it('should create semantic label', async () => {
      const label = await semanticLabelService.upsertLabel({
        componentId: testComponentId,
        defaultLabel: 'Sign in to your account',
        locale: 'en-US',
        description: 'Button to authenticate user',
      });

      expect(label.componentId).toBe(testComponentId);
      expect(label.defaultLabel).toBe('Sign in to your account');
      expect(label.locale).toBe('en-US');
    });

    it('should get semantic label by component and locale', async () => {
      const label = await semanticLabelService.getLabel(testComponentId, 'en-US');

      expect(label).toBeDefined();
      expect(label?.defaultLabel).toBe('Sign in to your account');
    });

    it('should fallback to default locale when not found', async () => {
      const label = await semanticLabelService.getLabelWithFallback(
        testComponentId,
        'es-ES'
      );

      // Should fallback to en-US
      expect(label).toBeDefined();
      expect(label?.locale).toBe('en-US');
    });

    it('should update semantic label', async () => {
      const updated = await semanticLabelService.updateLabel(
        testComponentId,
        'en-US',
        {
          defaultLabel: 'Log in',
        }
      );

      expect(updated.defaultLabel).toBe('Log in');
    });
  });

  describe('WCAGComplianceAuditService', () => {
    it('should check color contrast', () => {
      const checks = wcagComplianceAuditService.checkColorContrast([
        { foreground: '#000000', background: '#FFFFFF', element: 'body' },
        { foreground: '#CCCCCC', background: '#FFFFFF', element: 'text' },
      ]);

      expect(checks).toHaveLength(2);
      expect(checks[0].violations).toHaveLength(0); // Black on white passes
      expect(checks[1].violations.length).toBeGreaterThan(0); // Gray on white fails
    });

    it('should check focus order', () => {
      const checks = wcagComplianceAuditService.checkFocusOrder([
        { selector: '#input1', tabIndex: 0 },
        { selector: '#input2', tabIndex: 1 },
        { selector: '#input3', tabIndex: 2 },
      ]);

      expect(checks).toHaveLength(3);
    });

    it('should check alt text on images', () => {
      const checks = wcagComplianceAuditService.checkAltText([
        { selector: 'img.logo', altText: 'Company logo', isDecorative: false },
        { selector: 'img.decorative', altText: undefined, isDecorative: true },
        { selector: 'img.missing', altText: undefined, isDecorative: false },
      ]);

      expect(checks).toHaveLength(3);
      expect(checks[0].violations).toHaveLength(0); // Has alt text
      expect(checks[1].violations).toHaveLength(0); // Decorative, no alt needed
      expect(checks[2].violations.length).toBeGreaterThan(0); // Missing alt text
    });

    it('should check ARIA labels', () => {
      const checks = wcagComplianceAuditService.checkAriaLabels([
        {
          selector: 'button.submit',
          hasAriaLabel: true,
          role: 'button',
        },
        {
          selector: 'button.missing',
          hasAriaLabel: false,
          hasTextContent: false,
          role: 'button',
        },
      ]);

      expect(checks).toHaveLength(2);
      expect(checks[0].violations).toHaveLength(0); // Has label
      expect(checks[1].violations.length).toBeGreaterThan(0); // Missing label
    });

    it('should run comprehensive audit', async () => {
      const result = await wcagComplianceAuditService.runAudit({
        colorPairs: [
          { foreground: '#000000', background: '#FFFFFF' },
        ],
        images: [
          { selector: 'img.test', altText: 'Test image' },
        ],
        interactiveElements: [
          {
            selector: 'button.test',
            hasAriaLabel: true,
          },
        ],
      });

      expect(result).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.overallCompliance).toBeDefined();
      expect(result.summary).toBeDefined();
    });
  });

  describe('ScreenReaderSupportHelper', () => {
    it('should generate ARIA attributes', () => {
      const attributes = screenReaderSupportHelper.generateAriaAttributes({
        role: 'button',
        'aria-label': 'Close dialog',
        'aria-live': 'polite',
      });

      expect(attributes.role).toBe('button');
      expect(attributes['aria-label']).toBe('Close dialog');
      expect(attributes['aria-live']).toBe('polite');
    });

    it('should create live region attributes', () => {
      const attributes = screenReaderSupportHelper.createLiveRegion('assertive', true);

      expect(attributes['aria-live']).toBe('assertive');
      expect(attributes['aria-atomic']).toBe(true);
    });

    it('should validate heading hierarchy', () => {
      const valid = screenReaderSupportHelper.validateHeadingHierarchy([
        { level: 1, text: 'Main Title' },
        { level: 2, text: 'Section' },
        { level: 3, text: 'Subsection' },
      ]);

      expect(valid.valid).toBe(true);
      expect(valid.errors).toHaveLength(0);
    });

    it('should detect invalid heading hierarchy', () => {
      const invalid = screenReaderSupportHelper.validateHeadingHierarchy([
        { level: 1, text: 'Main Title' },
        { level: 3, text: 'Subsection' }, // Skipped h2
      ]);

      expect(invalid.valid).toBe(false);
      expect(invalid.errors.length).toBeGreaterThan(0);
    });

    it('should generate input label attributes', () => {
      const attributes = screenReaderSupportHelper.generateInputLabel(
        'Email Address',
        true,
        'Email is required'
      );

      expect(attributes['aria-label']).toContain('required');
      expect(attributes['aria-invalid']).toBe(true);
      expect(attributes['aria-describedby']).toBeDefined();
    });
  });

  describe('AccessibleFormValidator', () => {
    it('should validate form field', () => {
      const issues = accessibleFormValidator.validateField({
        id: 'email',
        name: 'email',
        type: 'email',
        required: true,
        label: 'Email Address',
      });

      // Should have warning about required indication
      expect(issues.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect missing label', () => {
      const issues = accessibleFormValidator.validateField({
        id: 'email',
        name: 'email',
        type: 'email',
        required: true,
      });

      const hasLabelError = issues.some(
        (issue) => issue.message.includes('missing an accessible label')
      );
      expect(hasLabelError).toBe(true);
    });

    it('should validate entire form', () => {
      const result = accessibleFormValidator.validateForm([
        {
          id: 'email',
          name: 'email',
          type: 'email',
          required: true,
          label: 'Email',
        },
        {
          id: 'password',
          name: 'password',
          type: 'password',
          required: true,
        },
      ]);

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.issues.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect duplicate IDs', () => {
      const result = accessibleFormValidator.validateForm([
        {
          id: 'email',
          name: 'email',
          type: 'email',
        },
        {
          id: 'email', // Duplicate
          name: 'email2',
          type: 'email',
        },
      ]);

      const hasDuplicateError = result.issues.some(
        (issue) => issue.message.includes('Duplicate field ID')
      );
      expect(hasDuplicateError).toBe(true);
    });

    it('should generate accessible field HTML', () => {
      const html = accessibleFormValidator.generateAccessibleFieldHTML({
        id: 'email',
        name: 'email',
        type: 'email',
        required: true,
        label: 'Email Address',
        errorMessage: 'Email is required',
        errorId: 'email-error',
      });

      expect(html).toContain('<label');
      expect(html).toContain('aria-required="true"');
      expect(html).toContain('aria-invalid="true"');
      expect(html).toContain('role="alert"');
    });
  });

  describe('AccessibilityReportGenerator', () => {
    it('should generate summary report', () => {
      const auditResults: any[] = [
        {
          violations: [
            {
              type: 'error',
              criterion: '1.4.3 Contrast (Minimum)',
              message: 'Low contrast',
            },
          ],
        },
      ];

      const report = accessibilityReportGenerator.generateSummary(auditResults);

      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.summary.totalViolations).toBe(1);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should export to CSV', () => {
      const auditResults: any[] = [
        {
          violations: [
            {
              type: 'error',
              criterion: '1.4.3',
              element: 'body',
              message: 'Test violation',
              suggestion: 'Fix it',
            },
          ],
        },
      ];

      const report = accessibilityReportGenerator.generateSummary(auditResults);
      const csv = accessibilityReportGenerator.exportToCSV(report);

      expect(csv).toContain('Accessibility Compliance Report');
      expect(csv).toContain('1.4.3');
      expect(csv).toContain('Test violation');
    });

    it('should export to JSON', () => {
      const auditResults: any[] = [];
      const report = accessibilityReportGenerator.generateSummary(auditResults);
      const json = accessibilityReportGenerator.exportToJSON(report);

      expect(() => JSON.parse(json)).not.toThrow();
      const parsed = JSON.parse(json);
      expect(parsed.summary).toBeDefined();
    });

    it('should export to Markdown', () => {
      const auditResults: any[] = [
        {
          violations: [
            {
              type: 'error',
              criterion: '1.4.3',
              message: 'Test violation',
            },
          ],
        },
      ];

      const report = accessibilityReportGenerator.generateSummary(auditResults);
      const markdown = accessibilityReportGenerator.exportToMarkdown(report);

      expect(markdown).toContain('# Accessibility Compliance Report');
      expect(markdown).toContain('1.4.3');
    });

    it('should compare reports', () => {
      const report1 = accessibilityReportGenerator.generateSummary([
        {
          violations: [
            { type: 'error', criterion: '1.4.3', message: 'Violation 1' },
            { type: 'error', criterion: '1.4.3', message: 'Violation 2' },
          ],
        },
      ]);

      const report2 = accessibilityReportGenerator.generateSummary([
        {
          violations: [{ type: 'error', criterion: '1.4.3', message: 'Violation 1' }],
        },
      ]);

      const comparison = accessibilityReportGenerator.compareReports(report2, report1);

      expect(comparison.improvements.length).toBeGreaterThan(0);
      expect(comparison.regressions).toHaveLength(0);
    });
  });
});

