/**
 * B242A-ACC-008: ScreenReaderSupportHelper
 *
 * Provides helper functions to add ARIA roles/attributes, manage focus,
 * announce dynamic content to screen readers, and ensure hidden elements
 * are skip-nav friendly.
 */

export interface AriaAttributes {
  role?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-live'?: 'polite' | 'assertive' | 'off';
  'aria-atomic'?: boolean;
  'aria-busy'?: boolean;
  'aria-hidden'?: boolean;
  'aria-expanded'?: boolean;
  'aria-controls'?: string;
  'aria-current'?: boolean | 'page' | 'step' | 'location' | 'date' | 'time';
}

export interface FocusOptions {
  preventScroll?: boolean;
  focusVisible?: boolean;
}

export class ScreenReaderSupportHelper {
  /**
   * Generate ARIA attributes object for an element
   */
  generateAriaAttributes(attributes: AriaAttributes): Record<string, string | boolean> {
    const result: Record<string, string | boolean> = {};

    Object.entries(attributes).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        result[key] = value;
      }
    });

    return result;
  }

  /**
   * Create a live region for announcing dynamic content
   */
  createLiveRegion(
    politeness: 'polite' | 'assertive' = 'polite',
    atomic: boolean = true
  ): AriaAttributes {
    return {
      'aria-live': politeness,
      'aria-atomic': atomic,
    };
  }

  /**
   * Announce a message to screen readers
   * In a browser environment, this would create/update a live region
   */
  announce(message: string, politeness: 'polite' | 'assertive' = 'polite'): void {
    if (typeof document !== 'undefined') {
      // Find or create a live region
      let liveRegion = document.getElementById('sr-live-region');

      if (!liveRegion) {
        liveRegion = document.createElement('div');
        liveRegion.id = 'sr-live-region';
        liveRegion.setAttribute('aria-live', politeness);
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.className = 'sr-only'; // Visually hidden but accessible to screen readers
        document.body.appendChild(liveRegion);
      }

      liveRegion.textContent = message;

      // Clear after announcement (for some screen readers)
      setTimeout(() => {
        if (liveRegion) {
          liveRegion.textContent = '';
        }
      }, 1000);
    }
  }

  /**
   * Manage focus programmatically
   */
  focusElement(elementId: string, options?: FocusOptions): boolean {
    if (typeof document !== 'undefined') {
      const element = document.getElementById(elementId);
      if (element) {
        element.focus({ preventScroll: options?.preventScroll });
        return true;
      }
    }
    return false;
  }

  /**
   * Trap focus within a container (useful for modals)
   */
  trapFocus(containerId: string): () => void {
    if (typeof document === 'undefined') {
      return () => {}; // No-op in non-browser environment
    }

    const container = document.getElementById(containerId);
    if (!container) {
      return () => {};
    }

    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);

    // Return cleanup function
    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }

  /**
   * Create skip navigation link
   */
  createSkipLink(href: string, text: string = 'Skip to main content'): string {
    return `
      <a href="${href}" class="skip-link sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white">
        ${text}
      </a>
    `;
  }

  /**
   * Make an element accessible to screen readers but visually hidden
   */
  makeScreenReaderOnly(content: string): string {
    return `
      <span class="sr-only">
        ${content}
      </span>
    `;
  }

  /**
   * Generate CSS for screen reader only content
   * This should be included in your global stylesheet
   */
  static getScreenReaderOnlyCSS(): string {
    return `
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border-width: 0;
      }

      .sr-only.focus\\:not-sr-only:focus {
        position: static;
        width: auto;
        height: auto;
        padding: inherit;
        margin: inherit;
        overflow: visible;
        clip: auto;
        white-space: normal;
      }
    `;
  }

  /**
   * Ensure proper heading hierarchy
   */
  validateHeadingHierarchy(headings: Array<{ level: number; text: string }>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    let previousLevel = 0;

    headings.forEach((heading, index) => {
      if (heading.level < 1 || heading.level > 6) {
        errors.push(`Invalid heading level ${heading.level} at index ${index}`);
        return;
      }

      // Check for skipped levels (e.g., h1 -> h3)
      if (previousLevel > 0 && heading.level > previousLevel + 1) {
        errors.push(
          `Skipped heading level: ${previousLevel} -> ${heading.level} at index ${index}`
        );
      }

      previousLevel = heading.level;
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate proper ARIA label for form inputs
   */
  generateInputLabel(
    labelText: string,
    required: boolean = false,
    errorMessage?: string
  ): AriaAttributes {
    const attributes: AriaAttributes = {
      'aria-label': required ? `${labelText} (required)` : labelText,
    };

    if (errorMessage) {
      attributes['aria-invalid'] = true;
      attributes['aria-describedby'] = `error-${labelText.toLowerCase().replace(/\s+/g, '-')}`;
    }

    return attributes;
  }
}

export const screenReaderSupportHelper = new ScreenReaderSupportHelper();

