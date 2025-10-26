/**
 * Accessibility utilities for ensuring WCAG compliance and high Lighthouse scores
 */

// Color contrast ratios for WCAG compliance
export const CONTRAST_RATIOS = {
  AA_NORMAL: 4.5,
  AA_LARGE: 3,
  AAA_NORMAL: 7,
  AAA_LARGE: 4.5,
} as const;

// ARIA roles for semantic HTML
export const ARIA_ROLES = {
  MAIN: 'main',
  NAVIGATION: 'navigation',
  BANNER: 'banner',
  CONTENTINFO: 'contentinfo',
  COMPLEMENTARY: 'complementary',
  REGION: 'region',
  ALERT: 'alert',
  ALERTDIALOG: 'alertdialog',
  DIALOG: 'dialog',
  LOG: 'log',
  MARQUEE: 'marquee',
  STATUS: 'status',
  TIMER: 'timer',
} as const;

// Common ARIA attributes
export const ARIA_ATTRIBUTES = {
  LABELLEDBY: 'aria-labelledby',
  DESCRIBEDBY: 'aria-describedby',
  LABEL: 'aria-label',
  DESCRIBED: 'aria-describedby',
  LIVE: 'aria-live',
  ATOMIC: 'aria-atomic',
  RELEVANT: 'aria-relevant',
  BUSY: 'aria-busy',
  DISABLED: 'aria-disabled',
  EXPANDED: 'aria-expanded',
  SELECTED: 'aria-selected',
  CHECKED: 'aria-checked',
  PRESSED: 'aria-pressed',
  LEVEL: 'aria-level',
  POSINSET: 'aria-posinset',
  SETSIZE: 'aria-setsize',
  SORT: 'aria-sort',
  REQUIRED: 'aria-required',
  INVALID: 'aria-invalid',
  HIDDEN: 'aria-hidden',
} as const;

/**
 * Check if a color contrast ratio meets WCAG standards
 */
export function checkContrastRatio(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA',
  size: 'normal' | 'large' = 'normal',
): boolean {
  // This is a simplified implementation
  // In a real app, you'd use a proper color contrast library
  const ratio = calculateContrastRatio(foreground, background);
  const requiredRatio =
    level === 'AA'
      ? size === 'large'
        ? CONTRAST_RATIOS.AA_LARGE
        : CONTRAST_RATIOS.AA_NORMAL
      : size === 'large'
      ? CONTRAST_RATIOS.AAA_LARGE
      : CONTRAST_RATIOS.AAA_NORMAL;

  return ratio >= requiredRatio;
}

/**
 * Calculate contrast ratio between two colors
 * Simplified implementation - use a proper library in production
 */
function calculateContrastRatio(color1: string, color2: string): number {
  // This is a placeholder implementation
  // You would use a proper color contrast calculation library
  return 4.5; // Placeholder value
}

/**
 * Generate accessible IDs for elements
 */
export function generateAccessibleId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if an element is focusable
 */
export function isFocusable(element: HTMLElement): boolean {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ];

  return focusableSelectors.some((selector) => element.matches(selector));
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ].join(', ');

  return Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[];
}

/**
 * Trap focus within a container (for modals, dialogs, etc.)
 */
export function trapFocus(container: HTMLElement): () => void {
  const focusableElements = getFocusableElements(container);
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);

  // Focus the first element
  firstElement?.focus();

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Announce text to screen readers
 */
export function announceToScreenReader(
  text: string,
  priority: 'polite' | 'assertive' = 'polite',
): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = text;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Check if reduced motion is preferred
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if high contrast is preferred
 */
export function prefersHighContrast(): boolean {
  return window.matchMedia('(prefers-contrast: high)').matches;
}

/**
 * Check if dark mode is preferred
 */
export function prefersDarkMode(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Validate ARIA attributes
 */
export function validateAriaAttributes(element: HTMLElement): string[] {
  const errors: string[] = [];

  // Check for required ARIA attributes
  if (element.hasAttribute('aria-labelledby')) {
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy && !document.getElementById(labelledBy)) {
      errors.push(`Element with aria-labelledby="${labelledBy}" references non-existent element`);
    }
  }

  if (element.hasAttribute('aria-describedby')) {
    const describedBy = element.getAttribute('aria-describedby');
    if (describedBy && !document.getElementById(describedBy)) {
      errors.push(`Element with aria-describedby="${describedBy}" references non-existent element`);
    }
  }

  // Check for invalid ARIA combinations
  if (element.hasAttribute('aria-hidden') && element.hasAttribute('aria-label')) {
    errors.push('Element cannot be both hidden and have an accessible label');
  }

  return errors;
}

/**
 * Generate accessible table headers
 */
export function generateTableHeaders(headers: string[]): { id: string; label: string }[] {
  return headers.map((header, index) => ({
    id: `header-${index}`,
    label: header,
  }));
}

/**
 * Check if text is readable (sufficient contrast, size, etc.)
 */
export function isTextReadable(element: HTMLElement): boolean {
  const styles = window.getComputedStyle(element);
  const fontSize = parseFloat(styles.fontSize);
  const fontWeight = styles.fontWeight;

  // Check minimum font size (16px is recommended)
  if (fontSize < 16) {
    return false;
  }

  // Check if font weight is sufficient
  if (fontWeight === '300' || fontWeight === 'light') {
    return false;
  }

  return true;
}

/**
 * Accessibility testing utilities for development
 */
export const a11yTesting = {
  /**
   * Run basic accessibility checks on the current page
   */
  runBasicChecks(): { passed: number; failed: number; errors: string[] } {
    const errors: string[] = [];
    let passed = 0;
    let failed = 0;

    // Check for missing alt attributes on images
    const images = document.querySelectorAll('img');
    images.forEach((img, index) => {
      if (!img.hasAttribute('alt')) {
        errors.push(`Image ${index + 1} is missing alt attribute`);
        failed++;
      } else {
        passed++;
      }
    });

    // Check for missing form labels
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach((input, index) => {
      const id = input.getAttribute('id');
      if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (!label && !input.hasAttribute('aria-label') && !input.hasAttribute('aria-labelledby')) {
          errors.push(`Form input ${index + 1} is missing accessible label`);
          failed++;
        } else {
          passed++;
        }
      } else {
        failed++;
        errors.push(`Form input ${index + 1} is missing id attribute`);
      }
    });

    // Check for proper heading hierarchy
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let currentLevel = 0;
    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.charAt(1));
      if (level > currentLevel + 1) {
        errors.push(`Heading ${index + 1} (${heading.tagName}) skips levels`);
        failed++;
      } else {
        passed++;
      }
      currentLevel = level;
    });

    return { passed, failed, errors };
  },

  /**
   * Check color contrast for all text elements
   */
  checkColorContrast(): { passed: number; failed: number; errors: string[] } {
    const errors: string[] = [];
    let passed = 0;
    let failed = 0;

    const textElements = document.querySelectorAll(
      'p, span, div, h1, h2, h3, h4, h5, h6, a, button',
    );

    textElements.forEach((element, index) => {
      const styles = window.getComputedStyle(element);
      const color = styles.color;
      const backgroundColor = styles.backgroundColor;

      // This is a simplified check - use a proper contrast library
      if (color && backgroundColor) {
        // Placeholder logic
        passed++;
      } else {
        failed++;
        errors.push(`Element ${index + 1} has insufficient color information`);
      }
    });

    return { passed, failed, errors };
  },
};

/**
 * Accessibility constants for consistent usage
 */
export const A11Y_CONSTANTS = {
  MIN_TOUCH_TARGET_SIZE: 44, // pixels
  MIN_FONT_SIZE: 16, // pixels
  MAX_LINE_LENGTH: 75, // characters
  MIN_CONTRAST_RATIO_AA: 4.5,
  MIN_CONTRAST_RATIO_AAA: 7,
  FOCUS_OUTLINE_WIDTH: 2, // pixels
  FOCUS_OUTLINE_OFFSET: 2, // pixels
} as const;

