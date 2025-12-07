/**
 * B242A-ACC-003: WCAGComplianceAuditService
 *
 * Evaluates pages/components against WCAG 2.1 AA criteria:
 * - Color contrast checks
 * - Focus order validation
 * - Alt text presence
 * - ARIA labels validation
 * Produces detailed reports with violations and suggestions.
 */

import { checkContrast, ContrastCheckResult } from '../utils/contrastChecker';

export interface WCAGViolation {
  type: 'error' | 'warning' | 'info';
  criterion: string; // WCAG criterion (e.g., "1.4.3 Contrast (Minimum)")
  element?: string; // Element selector or identifier
  message: string;
  suggestion?: string;
}

export interface ContrastCheck {
  foreground: string;
  background: string;
  element?: string;
  result: ContrastCheckResult;
  violations: WCAGViolation[];
}

export interface FocusOrderCheck {
  element: string;
  tabIndex: number;
  issues: WCAGViolation[];
}

export interface AltTextCheck {
  element: string;
  hasAltText: boolean;
  altText?: string;
  violations: WCAGViolation[];
}

export interface AriaLabelCheck {
  element: string;
  hasLabel: boolean;
  labelSource?: 'aria-label' | 'aria-labelledby' | 'text-content';
  violations: WCAGViolation[];
}

export interface WCAGAuditResult {
  pageUrl?: string;
  timestamp: Date;
  overallCompliance: 'pass' | 'fail' | 'partial';
  violations: WCAGViolation[];
  contrastChecks: ContrastCheck[];
  focusOrderChecks: FocusOrderCheck[];
  altTextChecks: AltTextCheck[];
  ariaLabelChecks: AriaLabelCheck[];
  summary: {
    totalViolations: number;
    errors: number;
    warnings: number;
    info: number;
  };
}

export class WCAGComplianceAuditService {
  /**
   * Check color contrast for a set of color pairs
   */
  checkColorContrast(
    colorPairs: Array<{ foreground: string; background: string; element?: string }>
  ): ContrastCheck[] {
    return colorPairs.map((pair) => {
      const result = checkContrast(pair.foreground, pair.background);
      const violations: WCAGViolation[] = [];

      if (!result.passesNormalTextAA) {
        violations.push({
          type: 'error',
          criterion: '1.4.3 Contrast (Minimum)',
          element: pair.element,
          message: `Normal text contrast ratio ${result.contrastRatio} is below WCAG AA minimum (4.5:1)`,
          suggestion: `Increase contrast between foreground (${pair.foreground}) and background (${pair.background}) colors`,
        });
      }

      if (!result.passesLargeTextAA) {
        violations.push({
          type: 'warning',
          criterion: '1.4.3 Contrast (Minimum)',
          element: pair.element,
          message: `Large text contrast ratio ${result.contrastRatio} is below WCAG AA minimum (3:1)`,
          suggestion: `Increase contrast for large text or use larger font sizes`,
        });
      }

      if (!result.passesUIComponentsAA) {
        violations.push({
          type: 'error',
          criterion: '1.4.11 Non-text Contrast',
          element: pair.element,
          message: `UI component contrast ratio ${result.contrastRatio} is below WCAG AA minimum (3:1)`,
          suggestion: `Increase contrast for UI components and graphical objects`,
        });
      }

      return {
        foreground: pair.foreground,
        background: pair.background,
        element: pair.element,
        result,
        violations,
      };
    });
  }

  /**
   * Check focus order for keyboard navigation
   */
  checkFocusOrder(
    elements: Array<{ selector: string; tabIndex: number }>
  ): FocusOrderCheck[] {
    const sorted = [...elements].sort((a, b) => a.tabIndex - b.tabIndex);
    const checks: FocusOrderCheck[] = [];

    sorted.forEach((element, index) => {
      const issues: WCAGViolation[] = [];

      // Check for positive tabIndex (should be avoided)
      if (element.tabIndex > 0) {
        issues.push({
          type: 'warning',
          criterion: '2.4.3 Focus Order',
          element: element.selector,
          message: `Element has positive tabIndex (${element.tabIndex}), which can disrupt natural focus order`,
          suggestion: 'Use tabIndex="0" or remove tabIndex to use natural DOM order',
        });
      }

      // Check for gaps in focus order
      if (index > 0 && element.tabIndex > sorted[index - 1].tabIndex + 1) {
        issues.push({
          type: 'warning',
          criterion: '2.4.3 Focus Order',
          element: element.selector,
          message: `Gap in focus order detected`,
          suggestion: 'Ensure all focusable elements are in logical order',
        });
      }

      checks.push({
        element: element.selector,
        tabIndex: element.tabIndex,
        issues,
      });
    });

    return checks;
  }

  /**
   * Check for alt text on images
   */
  checkAltText(
    images: Array<{ selector: string; altText?: string; isDecorative?: boolean }>
  ): AltTextCheck[] {
    return images.map((image) => {
      const violations: WCAGViolation[] = [];

      if (!image.altText && !image.isDecorative) {
        violations.push({
          type: 'error',
          criterion: '1.1.1 Non-text Content',
          element: image.selector,
          message: 'Image missing alt text',
          suggestion: 'Add descriptive alt text or mark as decorative with alt=""',
        });
      } else if (image.altText && image.isDecorative) {
        violations.push({
          type: 'warning',
          criterion: '1.1.1 Non-text Content',
          element: image.selector,
          message: 'Decorative image should have empty alt text',
          suggestion: 'Set alt="" for decorative images',
        });
      }

      return {
        element: image.selector,
        hasAltText: !!image.altText,
        altText: image.altText,
        violations,
      };
    });
  }

  /**
   * Check for ARIA labels on interactive elements
   */
  checkAriaLabels(
    elements: Array<{
      selector: string;
      hasAriaLabel?: boolean;
      hasAriaLabelledBy?: boolean;
      hasTextContent?: boolean;
      role?: string;
    }>
  ): AriaLabelCheck[] {
    return elements.map((element) => {
      const violations: WCAGViolation[] = [];
      const hasLabel =
        element.hasAriaLabel || element.hasAriaLabelledBy || element.hasTextContent;
      let labelSource: 'aria-label' | 'aria-labelledby' | 'text-content' | undefined;

      if (element.hasAriaLabel) {
        labelSource = 'aria-label';
      } else if (element.hasAriaLabelledBy) {
        labelSource = 'aria-labelledby';
      } else if (element.hasTextContent) {
        labelSource = 'text-content';
      }

      // Interactive elements should have accessible names
      if (!hasLabel && element.role !== 'presentation') {
        violations.push({
          type: 'error',
          criterion: '4.1.2 Name, Role, Value',
          element: element.selector,
          message: 'Interactive element missing accessible name',
          suggestion: 'Add aria-label, aria-labelledby, or visible text content',
        });
      }

      return {
        element: element.selector,
        hasLabel,
        labelSource,
        violations,
      };
    });
  }

  /**
   * Run a comprehensive WCAG audit
   */
  async runAudit(options: {
    pageUrl?: string;
    colorPairs?: Array<{ foreground: string; background: string; element?: string }>;
    focusableElements?: Array<{ selector: string; tabIndex: number }>;
    images?: Array<{ selector: string; altText?: string; isDecorative?: boolean }>;
    interactiveElements?: Array<{
      selector: string;
      hasAriaLabel?: boolean;
      hasAriaLabelledBy?: boolean;
      hasTextContent?: boolean;
      role?: string;
    }>;
  }): Promise<WCAGAuditResult> {
    const violations: WCAGViolation[] = [];
    const contrastChecks = options.colorPairs
      ? this.checkColorContrast(options.colorPairs)
      : [];
    const focusOrderChecks = options.focusableElements
      ? this.checkFocusOrder(options.focusableElements)
      : [];
    const altTextChecks = options.images ? this.checkAltText(options.images) : [];
    const ariaLabelChecks = options.interactiveElements
      ? this.checkAriaLabels(options.interactiveElements)
      : [];

    // Collect all violations
    contrastChecks.forEach((check) => violations.push(...check.violations));
    focusOrderChecks.forEach((check) => violations.push(...check.issues));
    altTextChecks.forEach((check) => violations.push(...check.violations));
    ariaLabelChecks.forEach((check) => violations.push(...check.violations));

    const errors = violations.filter((v) => v.type === 'error').length;
    const warnings = violations.filter((v) => v.type === 'warning').length;
    const info = violations.filter((v) => v.type === 'info').length;

    const overallCompliance =
      errors === 0 ? (warnings === 0 ? 'pass' : 'partial') : 'fail';

    return {
      pageUrl: options.pageUrl,
      timestamp: new Date(),
      overallCompliance,
      violations,
      contrastChecks,
      focusOrderChecks,
      altTextChecks,
      ariaLabelChecks,
      summary: {
        totalViolations: violations.length,
        errors,
        warnings,
        info,
      },
    };
  }
}

export const wcagComplianceAuditService = new WCAGComplianceAuditService();

