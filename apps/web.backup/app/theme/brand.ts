/**
 * VitalCV Brand Configuration (Round 15)
 *
 * Centralized brand identity for consistent theming across the platform.
 */

export const BRAND = {
  name: 'VitalCV',
  slogan: 'One Platform, Three Solutions: Empower. Streamline. Trust.',
  tagline: 'Healthcare Credentials, Reimagined',

  colors: {
    primary: '#0B6EFD', // Professional blue - trust and reliability
    accent: '#16A34A', // Healthcare green - growth and verification
    warning: '#F59E0B', // Amber - pilot mode and cautions
    danger: '#DC2626', // Red - revocation and errors
    success: '#10B981', // Green - verified and active
  },

  theme: {
    light: {
      background: '#FFFFFF',
      foreground: '#0F172A',
      muted: '#F1F5F9',
      border: '#E2E8F0',
    },
    dark: {
      background: '#0F172A',
      foreground: '#F8FAFC',
      muted: '#1E293B',
      border: '#334155',
    }
  },

  solutions: [
    {
      name: 'Empower',
      description: 'Clinician self-service credential management',
      icon: '👨‍⚕️',
      color: '#0B6EFD'
    },
    {
      name: 'Streamline',
      description: 'Issuer automation and workflow optimization',
      icon: '🏥',
      color: '#16A34A'
    },
    {
      name: 'Trust',
      description: 'Verifier instant credential validation',
      icon: '✓',
      color: '#8B5CF6'
    }
  ]
} as const;

/**
 * Apply brand CSS variables to document root
 */
export function applyBrandTheme() {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.style.setProperty('--brand-primary', BRAND.colors.primary);
  root.style.setProperty('--brand-accent', BRAND.colors.accent);
  root.style.setProperty('--brand-warning', BRAND.colors.warning);
  root.style.setProperty('--brand-danger', BRAND.colors.danger);
  root.style.setProperty('--brand-success', BRAND.colors.success);
}

