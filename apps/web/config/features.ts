/**
 * Feature Flags Configuration
 *
 * Control feature visibility based on environment, role, and level
 */

export type UserRole = 'holder' | 'issuer' | 'verifier' | 'admin' | 'developer';
export type ClaimLevel = 0 | 1 | 2 | 3;

export interface FeatureFlag {
  id: string;
  enabled: boolean;
  name: string;
  description: string;
  requiredRoles?: UserRole[];
  requiredLevel?: ClaimLevel;
  devOnly?: boolean;
  betaOnly?: boolean;
}

export const features: Record<string, FeatureFlag> = {
  // NPI & Claim Features
  npiClaim: {
    id: 'npi_claim',
    enabled: true,
    name: 'NPI Claim Wizard',
    description: 'Allow users to claim NPIs with multi-step verification',
  },
  npiPublicLookup: {
    id: 'npi_public_lookup',
    enabled: true,
    name: 'Public NPI Lookup',
    description: 'View public NPPES information',
  },

  // Wallet Features
  walletCredentials: {
    id: 'wallet_credentials',
    enabled: true,
    name: 'Credential Wallet',
    description: 'Store and manage verifiable credentials',
    requiredLevel: 1,
  },
  walletAccessLog: {
    id: 'wallet_access_log',
    enabled: true,
    name: 'Access Log',
    description: 'View credential access history',
    requiredLevel: 1,
  },
  walletExportPdf: {
    id: 'wallet_export_pdf',
    enabled: true,
    name: 'Export to PDF',
    description: 'Export credentials as PDF documents',
    requiredLevel: 1,
  },

  // Issuer Features
  issuerPortal: {
    id: 'issuer_portal',
    enabled: true,
    name: 'Issuer Portal',
    description: 'Issue and manage credentials',
    requiredRoles: ['issuer', 'admin'],
  },
  issuerBulkIssuance: {
    id: 'issuer_bulk_issuance',
    enabled: true,
    name: 'Bulk Issuance',
    description: 'Issue credentials via CSV upload',
    requiredRoles: ['issuer', 'admin'],
  },
  issuerTemplates: {
    id: 'issuer_templates',
    enabled: true,
    name: 'Credential Templates',
    description: 'Pre-configured credential templates',
    requiredRoles: ['issuer', 'admin'],
  },
  issuerAttestationInbox: {
    id: 'issuer_attestation_inbox',
    enabled: true,
    name: 'Attestation Inbox',
    description: 'Review and approve attestation requests',
    requiredRoles: ['issuer', 'admin'],
  },

  // Verifier Features
  verifierPortal: {
    id: 'verifier_portal',
    enabled: true,
    name: 'Verifier Portal',
    description: 'Verify credentials and presentations',
    requiredRoles: ['verifier', 'admin'],
  },
  verifierQrScan: {
    id: 'verifier_qr_scan',
    enabled: true,
    name: 'QR Code Scanning',
    description: 'Scan credentials via QR code',
    requiredRoles: ['verifier', 'admin'],
  },
  verifierPdfReport: {
    id: 'verifier_pdf_report',
    enabled: true,
    name: 'Verification Reports',
    description: 'Download verification reports as PDF',
    requiredRoles: ['verifier', 'admin'],
  },

  // Admin Features
  trustRegistry: {
    id: 'trust_registry',
    enabled: true,
    name: 'Trust Registry',
    description: 'Manage authorized issuers and verifiers',
    requiredRoles: ['admin'],
  },
  governance: {
    id: 'governance',
    enabled: false,
    name: 'Governance',
    description: 'View and vote on governance proposals',
    requiredRoles: ['admin'],
    betaOnly: true,
  },
  auditSearch: {
    id: 'audit_search',
    enabled: true,
    name: 'Audit Search',
    description: 'Search and export audit logs',
    requiredRoles: ['admin'],
  },
  impersonation: {
    id: 'impersonation',
    enabled: true,
    name: 'User Impersonation',
    description: 'Impersonate users for testing',
    requiredRoles: ['developer'],
    devOnly: true,
  },

  // Graph & Visualization
  graphVisualization: {
    id: 'graph_visualization',
    enabled: true,
    name: 'Graph Visualization',
    description: 'Interactive credential graph',
  },
  graphExport: {
    id: 'graph_export',
    enabled: true,
    name: 'Graph Export',
    description: 'Export graph as PNG',
  },

  // PWA Features
  pwaInstall: {
    id: 'pwa_install',
    enabled: true,
    name: 'PWA Installation',
    description: 'Install as progressive web app',
  },
  offlineMode: {
    id: 'offline_mode',
    enabled: true,
    name: 'Offline Mode',
    description: 'Limited functionality when offline',
  },

  // Developer Features
  devToolbar: {
    id: 'dev_toolbar',
    enabled: true,
    name: 'Developer Toolbar',
    description: 'Show developer tools and debug info',
    requiredRoles: ['developer'],
    devOnly: true,
  },
  mockBackend: {
    id: 'mock_backend',
    enabled: false,
    name: 'Mock Backend',
    description: 'Use mock API responses',
    devOnly: true,
  },
};

/**
 * Check if a feature is enabled for the given user context
 */
export function isFeatureEnabled(
  featureId: string,
  context?: {
    role?: UserRole;
    level?: ClaimLevel;
    isDev?: boolean;
    isBeta?: boolean;
  },
): boolean {
  const feature = features[featureId];

  if (!feature) {
    console.warn(`Feature "${featureId}" not found`);
    return false;
  }

  // Check if feature is globally enabled
  if (!feature.enabled) return false;

  // Check dev-only features
  if (feature.devOnly && !context?.isDev) {
    return false;
  }

  // Check beta-only features
  if (feature.betaOnly && !context?.isBeta) {
    return false;
  }

  // Check required roles
  if (feature.requiredRoles && context?.role) {
    if (!feature.requiredRoles.includes(context.role)) {
      return false;
    }
  }

  // Check required level
  if (feature.requiredLevel !== undefined && context?.level !== undefined) {
    if (context.level < feature.requiredLevel) {
      return false;
    }
  }

  return true;
}

/**
 * Get all enabled features for a user
 */
export function getEnabledFeatures(context?: {
  role?: UserRole;
  level?: ClaimLevel;
  isDev?: boolean;
  isBeta?: boolean;
}): FeatureFlag[] {
  return Object.values(features).filter((feature) => isFeatureEnabled(feature.id, context));
}

/**
 * Check environment
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function isBetaEnvironment(): boolean {
  return process.env.NEXT_PUBLIC_BETA === 'true';
}
