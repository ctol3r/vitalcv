/**
 * B242B-ACC-016: Focus Indicator Service
 *
 * Provides custom focus styles (visible focus outlines) adjustable by user preferences.
 * Ensures consistency across browsers.
 * Integrates with high-contrast mode.
 */

export interface FocusStyle {
  /** Outline width in pixels */
  width: number;
  /** Outline color */
  color: string;
  /** Outline style */
  style: 'solid' | 'dashed' | 'dotted' | 'double';
  /** Outline offset in pixels */
  offset: number;
  /** Border radius in pixels */
  borderRadius: number;
}

export interface FocusPreferences {
  /** User's preferred focus style */
  style: FocusStyle;
  /** Whether to use high contrast */
  highContrast: boolean;
  /** Whether focus indicators are enabled */
  enabled: boolean;
  /** Custom CSS class name */
  customClass?: string;
}

/**
 * Default focus styles
 */
export const DEFAULT_FOCUS_STYLES: Record<string, FocusStyle> = {
  default: {
    width: 2,
    color: '#005fcc',
    style: 'solid',
    offset: 2,
    borderRadius: 2,
  },
  highContrast: {
    width: 3,
    color: '#000000',
    style: 'solid',
    offset: 3,
    borderRadius: 0,
  },
  highContrastLight: {
    width: 3,
    color: '#ffffff',
    style: 'solid',
    offset: 3,
    borderRadius: 0,
  },
  subtle: {
    width: 1,
    color: '#005fcc',
    style: 'dashed',
    offset: 1,
    borderRadius: 4,
  },
  bold: {
    width: 4,
    color: '#005fcc',
    style: 'solid',
    offset: 4,
    borderRadius: 0,
  },
};

/**
 * Focus Indicator Service
 */
export class FocusIndicatorService {
  private preferences: FocusPreferences;
  private styleElement: HTMLStyleElement | null = null;

  constructor(preferences?: Partial<FocusPreferences>) {
    this.preferences = {
      style: DEFAULT_FOCUS_STYLES.default,
      highContrast: false,
      enabled: true,
      ...preferences,
    };
  }

  /**
   * Update user preferences
   */
  updatePreferences(preferences: Partial<FocusPreferences>): void {
    this.preferences = {
      ...this.preferences,
      ...preferences,
    };
    this.applyStyles();
  }

  /**
   * Get current preferences
   */
  getPreferences(): FocusPreferences {
    return { ...this.preferences };
  }

  /**
   * Get the appropriate focus style based on preferences
   */
  getFocusStyle(): FocusStyle {
    if (this.preferences.highContrast) {
      // Determine if background is light or dark
      const isLight = this.detectLightBackground();
      return isLight
        ? DEFAULT_FOCUS_STYLES.highContrast
        : DEFAULT_FOCUS_STYLES.highContrastLight;
    }

    if (this.preferences.style) {
      return this.preferences.style;
    }

    return DEFAULT_FOCUS_STYLES.default;
  }

  /**
   * Detect if the current background is light or dark
   */
  private detectLightBackground(): boolean {
    if (typeof window === 'undefined') {
      return true;
    }

    // Check for dark mode preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return false;
    }

    // Check computed background color
    const body = document.body;
    if (body) {
      const bgColor = window.getComputedStyle(body).backgroundColor;
      // Simple heuristic: check if it's closer to white or black
      const rgb = bgColor.match(/\d+/g);
      if (rgb && rgb.length >= 3) {
        const brightness =
          (parseInt(rgb[0]) + parseInt(rgb[1]) + parseInt(rgb[2])) / 3;
        return brightness > 128;
      }
    }

    return true;
  }

  /**
   * Generate CSS for focus indicators
   */
  generateCSS(): string {
    if (!this.preferences.enabled) {
      return `
        *:focus {
          outline: none !important;
        }
      `;
    }

    const style = this.getFocusStyle();
    const customClass = this.preferences.customClass || '';

    return `
      ${customClass ? `.${customClass} ` : ''}*:focus {
        outline: ${style.width}px ${style.style} ${style.color} !important;
        outline-offset: ${style.offset}px !important;
        border-radius: ${style.borderRadius}px !important;
      }

      ${customClass ? `.${customClass} ` : ''}*:focus-visible {
        outline: ${style.width}px ${style.style} ${style.color} !important;
        outline-offset: ${style.offset}px !important;
        border-radius: ${style.borderRadius}px !important;
      }

      ${customClass ? `.${customClass} ` : ''}button:focus,
      ${customClass ? `.${customClass} ` : ''}a:focus,
      ${customClass ? `.${customClass} ` : ''}input:focus,
      ${customClass ? `.${customClass} ` : ''}select:focus,
      ${customClass ? `.${customClass} ` : ''}textarea:focus {
        outline: ${style.width}px ${style.style} ${style.color} !important;
        outline-offset: ${style.offset}px !important;
        border-radius: ${style.borderRadius}px !important;
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        ${customClass ? `.${customClass} ` : ''}*:focus {
          outline: 3px solid ${style.color} !important;
          outline-offset: 3px !important;
        }
      }

      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        ${customClass ? `.${customClass} ` : ''}*:focus {
          transition: none !important;
        }
      }
    `;
  }

  /**
   * Apply focus styles to the document
   */
  applyStyles(): void {
    if (typeof document === 'undefined') {
      return;
    }

    // Remove existing style element
    if (this.styleElement) {
      this.styleElement.remove();
    }

    if (!this.preferences.enabled) {
      return;
    }

    // Create new style element
    this.styleElement = document.createElement('style');
    this.styleElement.id = 'focus-indicator-styles';
    this.styleElement.textContent = this.generateCSS();
    document.head.appendChild(this.styleElement);
  }

  /**
   * Remove focus styles from the document
   */
  removeStyles(): void {
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }
  }

  /**
   * Enable focus indicators
   */
  enable(): void {
    this.updatePreferences({ enabled: true });
  }

  /**
   * Disable focus indicators
   */
  disable(): void {
    this.updatePreferences({ enabled: false });
  }

  /**
   * Set high contrast mode
   */
  setHighContrast(enabled: boolean): void {
    this.updatePreferences({ highContrast: enabled });
  }

  /**
   * Apply focus style to a specific element
   */
  applyToElement(element: HTMLElement, style?: Partial<FocusStyle>): void {
    const focusStyle = style || this.getFocusStyle();
    element.style.outline = `${focusStyle.width}px ${focusStyle.style} ${focusStyle.color}`;
    element.style.outlineOffset = `${focusStyle.offset}px`;
    element.style.borderRadius = `${focusStyle.borderRadius}px`;
  }

  /**
   * Remove focus style from a specific element
   */
  removeFromElement(element: HTMLElement): void {
    element.style.outline = '';
    element.style.outlineOffset = '';
    element.style.borderRadius = '';
  }

  /**
   * Check if focus indicators are visible
   */
  isVisible(): boolean {
    return this.preferences.enabled;
  }

  /**
   * Validate focus style meets accessibility requirements
   */
  validateStyle(style: FocusStyle): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check minimum width (WCAG recommends at least 2px)
    if (style.width < 2) {
      issues.push('Focus outline width should be at least 2px for visibility');
    }

    // Check color contrast (should be high contrast)
    // This is a simplified check - in production, use proper contrast calculation
    if (style.color === 'transparent' || !style.color) {
      issues.push('Focus outline color must be visible');
    }

    // Check offset (should be positive for visibility)
    if (style.offset < 0) {
      issues.push('Focus outline offset should be non-negative');
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  /**
   * Get browser-specific focus styles
   */
  getBrowserSpecificStyles(): Record<string, string> {
    return {
      // Webkit browsers
      '-webkit-focus-ring-color': this.getFocusStyle().color,
      '-webkit-focus-ring-width': `${this.getFocusStyle().width}px`,
      '-webkit-focus-ring-style': this.getFocusStyle().style,
      // Firefox
      '-moz-outline-color': this.getFocusStyle().color,
      '-moz-outline-width': `${this.getFocusStyle().width}px`,
      '-moz-outline-style': this.getFocusStyle().style,
    };
  }
}

/**
 * Singleton instance
 */
export const focusIndicatorService = new FocusIndicatorService();

/**
 * Initialize focus indicators on page load
 */
export function initializeFocusIndicators(
  preferences?: Partial<FocusPreferences>
): FocusIndicatorService {
  const service = new FocusIndicatorService(preferences);

  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        service.applyStyles();
      });
    } else {
      service.applyStyles();
    }
  }

  return service;
}

/**
 * Default export
 */
export default focusIndicatorService;

