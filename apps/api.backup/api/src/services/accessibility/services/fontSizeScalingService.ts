/**
 * B242A-ACC-005: FontSizeScalingService
 *
 * Applies user-defined text scaling across the application by modifying
 * CSS variables and updating document root to ensure readability without breaking layout.
 */

export interface FontSizeScalingOptions {
  scale: number; // Scale factor (e.g., 1.0 = 100%, 1.5 = 150%)
  minScale?: number; // Minimum allowed scale (default: 0.5)
  maxScale?: number; // Maximum allowed scale (default: 3.0)
}

export class FontSizeScalingService {
  private readonly DEFAULT_MIN_SCALE = 0.5;
  private readonly DEFAULT_MAX_SCALE = 3.0;
  private readonly CSS_VAR_NAME = '--text-size-scale';

  /**
   * Validate and clamp scale value to safe range
   */
  private clampScale(scale: number, min?: number, max?: number): number {
    const minScale = min ?? this.DEFAULT_MIN_SCALE;
    const maxScale = max ?? this.DEFAULT_MAX_SCALE;
    return Math.max(minScale, Math.min(maxScale, scale));
  }

  /**
   * Apply text scaling to CSS variables
   * This should be called on the frontend to update the document root
   */
  applyScaling(scale: number, options?: Partial<FontSizeScalingOptions>): number {
    const clampedScale = this.clampScale(scale, options?.minScale, options?.maxScale);

    // In a browser environment, this would update the CSS variable
    // For server-side, we return the scale value to be used in templates
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty(this.CSS_VAR_NAME, clampedScale.toString());
    }

    return clampedScale;
  }

  /**
   * Get the current scale value from CSS variable
   */
  getCurrentScale(): number {
    if (typeof document !== 'undefined') {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue(this.CSS_VAR_NAME)
        .trim();
      return value ? parseFloat(value) : 1.0;
    }
    return 1.0;
  }

  /**
   * Generate CSS for text scaling
   * This can be injected into the page or included in a stylesheet
   */
  generateCSS(scale: number): string {
    const clampedScale = this.clampScale(scale);
    return `
      :root {
        ${this.CSS_VAR_NAME}: ${clampedScale};
      }

      /* Apply scaling to text elements */
      body {
        font-size: calc(1rem * var(${this.CSS_VAR_NAME}, 1));
      }

      /* Scale headings proportionally */
      h1 { font-size: calc(2rem * var(${this.CSS_VAR_NAME}, 1)); }
      h2 { font-size: calc(1.5rem * var(${this.CSS_VAR_NAME}, 1)); }
      h3 { font-size: calc(1.25rem * var(${this.CSS_VAR_NAME}, 1)); }

      /* Ensure buttons and inputs scale appropriately */
      button, input, select, textarea {
        font-size: calc(1rem * var(${this.CSS_VAR_NAME}, 1));
      }
    `;
  }

  /**
   * Calculate scaled font size in pixels
   */
  calculateScaledSize(baseSize: number, scale: number): number {
    const clampedScale = this.clampScale(scale);
    return Math.round(baseSize * clampedScale);
  }

  /**
   * Check if layout might break with given scale
   * Returns warnings if scale is too extreme
   */
  validateScale(scale: number): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    const clampedScale = this.clampScale(scale);

    if (scale !== clampedScale) {
      warnings.push(`Scale clamped from ${scale} to ${clampedScale}`);
    }

    if (clampedScale < 0.75) {
      warnings.push('Very small text may be difficult to read');
    }

    if (clampedScale > 2.0) {
      warnings.push('Large text scaling may cause layout issues');
    }

    return {
      valid: clampedScale >= this.DEFAULT_MIN_SCALE && clampedScale <= this.DEFAULT_MAX_SCALE,
      warnings,
    };
  }
}

export const fontSizeScalingService = new FontSizeScalingService();

