/**
 * LumenColorEngine
 * Dynamic spectral color mapping based on trust, compliance, and risk
 */

import type { LumenColorSpectrum, TrustScore, RiskScore, ComplianceScore, RoleType } from './types';

export class LumenColorEngine {
  private spectrum: LumenColorSpectrum;
  private roleModifiers: Map<RoleType, Partial<LumenColorSpectrum>>;

  constructor(spectrum: LumenColorSpectrum) {
    this.spectrum = spectrum;
    this.roleModifiers = new Map();

    // Role-specific palette modifications
    this.roleModifiers.set('Nurse', {
      emerald: '#06b6d4', // cyan-500
      anchorBlue: '#0284c7', // sky-700
    });

    this.roleModifiers.set('Recruiter', {
      emerald: '#8b5cf6', // violet-500
      anchorBlue: '#6366f1', // indigo-500
    });

    this.roleModifiers.set('Facility', {
      emerald: '#059669', // emerald-600
      anchorBlue: '#0891b2', // cyan-600
    });
  }

  /**
   * Get role-modified spectrum
   */
  getSpectrumForRole(role: RoleType): LumenColorSpectrum {
    const modifier = this.roleModifiers.get(role);
    return modifier ? { ...this.spectrum, ...modifier } : this.spectrum;
  }

  /**
   * Calculate trust gradient color
   */
  getTrustGradient(trustScore: TrustScore, role?: RoleType): string {
    const spectrum = role ? this.getSpectrumForRole(role) : this.spectrum;

    if (trustScore >= 0.9) {
      return this.lighten(spectrum.emerald, 0.2);
    }
    if (trustScore >= 0.7) {
      return spectrum.emerald;
    }
    if (trustScore >= 0.5) {
      return this.interpolate(spectrum.riskAmber, spectrum.emerald, (trustScore - 0.5) / 0.2);
    }
    if (trustScore >= 0.3) {
      return spectrum.riskAmber;
    }
    return this.darken(spectrum.riskAmber, 0.3);
  }

  /**
   * Calculate compliance color
   */
  getComplianceColor(compliance: ComplianceScore): string {
    if (compliance >= 0.9) return this.spectrum.emerald;
    if (compliance >= 0.7) return this.spectrum.anchorBlue;
    if (compliance >= 0.5) return this.spectrum.complianceGray;
    if (compliance >= 0.3) return this.spectrum.riskAmber;
    return this.darken(this.spectrum.riskAmber, 0.5);
  }

  /**
   * Calculate risk color intensity
   */
  getRiskColor(riskScore: RiskScore): string {
    if (riskScore >= 0.8) {
      return this.darken(this.spectrum.riskAmber, 0.4);
    }
    if (riskScore >= 0.5) {
      return this.spectrum.riskAmber;
    }
    if (riskScore >= 0.3) {
      return this.lighten(this.spectrum.riskAmber, 0.3);
    }
    return this.spectrum.complianceGray;
  }

  /**
   * Calculate ZK proof veil color
   */
  getZKVeilColor(revealed: boolean, progress: number = 1.0): string {
    if (revealed) {
      return this.lighten(this.spectrum.veilPurple, 0.3 * progress);
    }
    return this.darken(this.spectrum.veilPurple, 0.5 * (1 - progress));
  }

  /**
   * Get dynamic opacity based on risk
   */
  getDynamicOpacity(baseOpacity: number, riskScore: RiskScore): number {
    // Higher risk = lower opacity
    return baseOpacity * (1 - riskScore * 0.5);
  }

  /**
   * Interpolate between two hex colors
   */
  private interpolate(color1: string, color2: string, factor: number): string {
    const c1 = this.hexToRgb(color1);
    const c2 = this.hexToRgb(color2);
    if (!c1 || !c2) return color1;

    const r = Math.round(c1.r + (c2.r - c1.r) * factor);
    const g = Math.round(c1.g + (c2.g - c1.g) * factor);
    const b = Math.round(c1.b + (c2.b - c1.b) * factor);

    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Lighten a hex color
   */
  private lighten(hex: string, factor: number): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return hex;

    const r = Math.min(255, Math.round(rgb.r + (255 - rgb.r) * factor));
    const g = Math.min(255, Math.round(rgb.g + (255 - rgb.g) * factor));
    const b = Math.min(255, Math.round(rgb.b + (255 - rgb.b) * factor));

    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Darken a hex color
   */
  private darken(hex: string, factor: number): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return hex;

    const r = Math.round(rgb.r * (1 - factor));
    const g = Math.round(rgb.g * (1 - factor));
    const b = Math.round(rgb.b * (1 - factor));

    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Convert hex to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }
}

