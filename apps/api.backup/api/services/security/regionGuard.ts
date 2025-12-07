const log = getServiceLogger('security/regionGuard');
/**
 * B139A-INTL-004: Data Residency Guard
 *
 * Prevents PHI data from being accessed across disallowed regions.
 *
 * Key Principles:
 * - PHI data MUST stay within home region boundaries
 * - Cross-region access for non-PHI metadata only (directory, credentials)
 * - All denied attempts are logged for security auditing
 * - Enforcement at database query level
 */

import { Region } from '../org/models/TenantRegion';
import { getServiceLogger } from '../logging/serviceLogger';

/**
 * Data classification
 */
export enum DataClassification {
  PHI = 'phi',               // Protected Health Information - MUST NOT cross regions
  NON_PHI = 'non_phi',       // Non-PHI data - can be replicated
  PII = 'pii',               // Personally Identifiable Information - restricted
  PUBLIC = 'public',         // Public data - no restrictions
}

/**
 * Resource types and their classifications
 */
export const RESOURCE_CLASSIFICATIONS: Record<string, DataClassification> = {
  // PHI Resources (MUST stay in home region)
  'patients': DataClassification.PHI,
  'encounters': DataClassification.PHI,
  'observations': DataClassification.PHI,
  'diagnosticReports': DataClassification.PHI,
  'medications': DataClassification.PHI,
  'procedures': DataClassification.PHI,
  'conditions': DataClassification.PHI,
  'clinicalNotes': DataClassification.PHI,
  'labResults': DataClassification.PHI,
  'imaging': DataClassification.PHI,
  'vitalSigns': DataClassification.PHI,
  'immunizations': DataClassification.PHI,
  'allergies': DataClassification.PHI,
  'careTeams': DataClassification.PHI,
  'carePlans': DataClassification.PHI,
  'goals': DataClassification.PHI,
  'providerPatientRelationships': DataClassification.PHI,
  'appointments': DataClassification.PHI,
  'referrals': DataClassification.PHI,

  // PII Resources (restricted but not PHI)
  'providerEmploymentHistory': DataClassification.PII,
  'providerEducation': DataClassification.PII,
  'providerContactInfo': DataClassification.PII,
  'tenantUsers': DataClassification.PII,

  // Non-PHI Resources (can be replicated)
  'providerCredentials': DataClassification.NON_PHI,
  'providerLicenses': DataClassification.NON_PHI,
  'providerCertifications': DataClassification.NON_PHI,
  'compactStatus': DataClassification.NON_PHI,
  'facilityDirectory': DataClassification.NON_PHI,

  // Public Resources (no restrictions)
  'publicDirectory': DataClassification.PUBLIC,
  'npiRegistry': DataClassification.PUBLIC,
  'stateBoards': DataClassification.PUBLIC,
};

/**
 * Access request context
 */
export interface AccessContext {
  tenantId: string;
  userId?: string;
  resourceType: string;
  resourceId?: string;
  operation: 'read' | 'write' | 'delete';
  sourceRegion: Region;
  targetRegion: Region;
  purpose?: string; // Purpose of Use (e.g., 'treatment', 'directory_sync')
}

/**
 * Access decision
 */
export interface AccessDecision {
  allowed: boolean;
  reason: string;
  classification: DataClassification;
  requiresAudit: boolean;
  warnings?: string[];
}

/**
 * Audit log entry
 */
export interface RegionAccessAuditLog {
  timestamp: Date;
  tenantId: string;
  userId?: string;
  resourceType: string;
  resourceId?: string;
  operation: string;
  sourceRegion: Region;
  targetRegion: Region;
  allowed: boolean;
  reason: string;
  classification: DataClassification;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * In-memory audit log (in production, send to CloudWatch/SIEM)
 */
const auditLogs: RegionAccessAuditLog[] = [];

/**
 * Get resource classification
 */
export function getResourceClassification(resourceType: string): DataClassification {
  return RESOURCE_CLASSIFICATIONS[resourceType] || DataClassification.PHI; // Default to PHI for safety
}

/**
 * Check if resource is PHI
 */
export function isPhiResource(resourceType: string): boolean {
  return getResourceClassification(resourceType) === DataClassification.PHI;
}

/**
 * Evaluate region access request
 */
export function evaluateRegionAccess(context: AccessContext): AccessDecision {
  const classification = getResourceClassification(context.resourceType);

  // Same region access - always allowed
  if (context.sourceRegion === context.targetRegion) {
    return {
      allowed: true,
      reason: 'Same region access',
      classification,
      requiresAudit: false,
    };
  }

  // Cross-region access rules
  switch (classification) {
    case DataClassification.PHI:
      // PHI MUST NOT cross region boundaries
      return {
        allowed: false,
        reason: 'PHI data cannot cross region boundaries',
        classification,
        requiresAudit: true,
      };

    case DataClassification.PII:
      // PII generally should not cross regions unless for specific purposes
      if (context.purpose === 'directory_sync' || context.purpose === 'credential_verification') {
        return {
          allowed: true,
          reason: `PII access allowed for purpose: ${context.purpose}`,
          classification,
          requiresAudit: true,
          warnings: ['Cross-region PII access - ensure minimal necessary data'],
        };
      }
      return {
        allowed: false,
        reason: 'PII cross-region access not permitted without valid purpose',
        classification,
        requiresAudit: true,
      };

    case DataClassification.NON_PHI:
      // Non-PHI can be accessed cross-region with audit
      return {
        allowed: true,
        reason: 'Non-PHI data - cross-region access permitted',
        classification,
        requiresAudit: true,
      };

    case DataClassification.PUBLIC:
      // Public data - no restrictions
      return {
        allowed: true,
        reason: 'Public data - no region restrictions',
        classification,
        requiresAudit: false,
      };

    default:
      // Unknown classification - default to deny for safety
      return {
        allowed: false,
        reason: 'Unknown classification - defaulting to deny',
        classification,
        requiresAudit: true,
      };
  }
}

/**
 * Log access attempt
 */
export function logRegionAccess(
  context: AccessContext,
  decision: AccessDecision,
  metadata?: { ipAddress?: string; userAgent?: string }
): void {
  const logEntry: RegionAccessAuditLog = {
    timestamp: new Date(),
    tenantId: context.tenantId,
    userId: context.userId,
    resourceType: context.resourceType,
    resourceId: context.resourceId,
    operation: context.operation,
    sourceRegion: context.sourceRegion,
    targetRegion: context.targetRegion,
    allowed: decision.allowed,
    reason: decision.reason,
    classification: decision.classification,
    ipAddress: metadata?.ipAddress,
    userAgent: metadata?.userAgent,
  };

  auditLogs.push(logEntry);

  // In production, also send to CloudWatch Logs, SIEM, or dedicated audit service
  if (!decision.allowed) {
    log.warn('[REGION_GUARD] Access denied:', JSON.stringify(logEntry));
  } else if (decision.requiresAudit) {
    log.info('[REGION_GUARD] Cross-region access:', JSON.stringify(logEntry));
  }
}

/**
 * Check and enforce region access
 * Main entry point for region guard
 */
export function checkRegionAccess(context: AccessContext): AccessDecision {
  const decision = evaluateRegionAccess(context);

  if (decision.requiresAudit || !decision.allowed) {
    logRegionAccess(context, decision);
  }

  return decision;
}

/**
 * Middleware-compatible region guard
 * Throws error if access is denied
 */
export function enforceRegionAccess(context: AccessContext): void {
  const decision = checkRegionAccess(context);

  if (!decision.allowed) {
    throw new RegionAccessDeniedError(
      decision.reason,
      context.resourceType,
      context.sourceRegion,
      context.targetRegion
    );
  }

  if (decision.warnings && decision.warnings.length > 0) {
    log.warn('[REGION_GUARD] Warnings:', decision.warnings.join('; '));
  }
}

/**
 * Region access denied error
 */
export class RegionAccessDeniedError extends Error {
  constructor(
    public reason: string,
    public resourceType: string,
    public sourceRegion: Region,
    public targetRegion: Region
  ) {
    super(`Region access denied: ${reason}`);
    this.name = 'RegionAccessDeniedError';
  }

  toJSON() {
    return {
      error: 'Region access denied',
      code: 'REGION_ACCESS_DENIED',
      reason: this.reason,
      resourceType: this.resourceType,
      sourceRegion: this.sourceRegion,
      targetRegion: this.targetRegion,
    };
  }
}

/**
 * Get audit logs (for testing/monitoring)
 */
export function getAuditLogs(filters?: {
  tenantId?: string;
  allowed?: boolean;
  classification?: DataClassification;
  startDate?: Date;
  endDate?: Date;
}): RegionAccessAuditLog[] {
  let filtered = [...auditLogs];

  if (filters) {
    if (filters.tenantId) {
      filtered = filtered.filter(log => log.tenantId === filters.tenantId);
    }
    if (filters.allowed !== undefined) {
      filtered = filtered.filter(log => log.allowed === filters.allowed);
    }
    if (filters.classification) {
      filtered = filtered.filter(log => log.classification === filters.classification);
    }
    if (filters.startDate) {
      filtered = filtered.filter(log => log.timestamp >= filters.startDate!);
    }
    if (filters.endDate) {
      filtered = filtered.filter(log => log.timestamp <= filters.endDate!);
    }
  }

  return filtered;
}

/**
 * Clear audit logs (for testing)
 */
export function clearAuditLogs(): void {
  auditLogs.length = 0;
}

/**
 * Get region guard metrics
 */
export interface RegionGuardMetrics {
  totalRequests: number;
  allowed: number;
  denied: number;
  byClassification: Record<DataClassification, { allowed: number; denied: number }>;
  deniedReasons: Record<string, number>;
}

export function getRegionGuardMetrics(): RegionGuardMetrics {
  const metrics: RegionGuardMetrics = {
    totalRequests: auditLogs.length,
    allowed: 0,
    denied: 0,
    byClassification: {
      [DataClassification.PHI]: { allowed: 0, denied: 0 },
      [DataClassification.PII]: { allowed: 0, denied: 0 },
      [DataClassification.NON_PHI]: { allowed: 0, denied: 0 },
      [DataClassification.PUBLIC]: { allowed: 0, denied: 0 },
    },
    deniedReasons: {},
  };

  for (const log of auditLogs) {
    if (log.allowed) {
      metrics.allowed++;
      metrics.byClassification[log.classification].allowed++;
    } else {
      metrics.denied++;
      metrics.byClassification[log.classification].denied++;
      metrics.deniedReasons[log.reason] = (metrics.deniedReasons[log.reason] || 0) + 1;
    }
  }

  return metrics;
}

/**
 * Database query wrapper with region enforcement
 *
 * Usage:
 * ```typescript
 * const result = await withRegionGuard(
 *   { tenantId, resourceType: 'patients', sourceRegion, targetRegion, operation: 'read' },
 *   async () => db.query('SELECT * FROM patients WHERE tenant_id = $1', [tenantId])
 * );
 * ```
 */
export async function withRegionGuard<T>(
  context: AccessContext,
  queryFn: () => Promise<T>
): Promise<T> {
  enforceRegionAccess(context);
  return await queryFn();
}

/**
 * Validate region for tenant data access
 * Helper function for common use case
 */
export function validateTenantRegion(
  tenantId: string,
  resourceType: string,
  currentRegion: Region,
  tenantHomeRegion: Region
): void {
  const context: AccessContext = {
    tenantId,
    resourceType,
    operation: 'read',
    sourceRegion: currentRegion,
    targetRegion: tenantHomeRegion,
  };

  enforceRegionAccess(context);
}

/**
 * Check if cross-region sync is allowed for resource type
 */
export function canSyncAcrossRegions(resourceType: string): boolean {
  const classification = getResourceClassification(resourceType);
  return classification === DataClassification.NON_PHI || classification === DataClassification.PUBLIC;
}

/**
 * Get syncable resource types
 */
export function getSyncableResourceTypes(): string[] {
  return Object.entries(RESOURCE_CLASSIFICATIONS)
    .filter(([_, classification]) =>
      classification === DataClassification.NON_PHI ||
      classification === DataClassification.PUBLIC
    )
    .map(([resourceType]) => resourceType);
}

/**
 * Get PHI resource types (never syncable)
 */
export function getPhiResourceTypes(): string[] {
  return Object.entries(RESOURCE_CLASSIFICATIONS)
    .filter(([_, classification]) => classification === DataClassification.PHI)
    .map(([resourceType]) => resourceType);
}

/**
 * Example usage documentation
 */
export const USAGE_EXAMPLES = `
# Region Guard Usage Examples

## Check PHI access across regions (should be denied)

\`\`\`typescript
import { checkRegionAccess, Region } from './regionGuard';

const context = {
  tenantId: '550e8400-e29b-41d4-a716-446655440000',
  userId: 'user-123',
  resourceType: 'patients',
  resourceId: 'patient-456',
  operation: 'read' as const,
  sourceRegion: Region.US,
  targetRegion: Region.EU, // Trying to access EU patient data from US
};

const decision = checkRegionAccess(context);
log.info(decision);
// Output: { allowed: false, reason: 'PHI data cannot cross region boundaries', ... }
\`\`\`

## Check non-PHI access (should be allowed)

\`\`\`typescript
const context = {
  tenantId: '550e8400-e29b-41d4-a716-446655440000',
  resourceType: 'providerCredentials',
  operation: 'read' as const,
  sourceRegion: Region.US,
  targetRegion: Region.EU,
  purpose: 'directory_sync',
};

const decision = checkRegionAccess(context);
log.info(decision);
// Output: { allowed: true, reason: 'Non-PHI data - cross-region access permitted', ... }
\`\`\`

## Use as database query guard

\`\`\`typescript
import { withRegionGuard, Region } from './regionGuard';

const patients = await withRegionGuard(
  {
    tenantId: '550e8400-e29b-41d4-a716-446655440000',
    resourceType: 'patients',
    operation: 'read',
    sourceRegion: Region.US,
    targetRegion: Region.US, // Same region - allowed
  },
  async () => db.query('SELECT * FROM patients WHERE tenant_id = $1', [tenantId])
);
\`\`\`

## Get audit logs of denied accesses

\`\`\`typescript
import { getAuditLogs, DataClassification } from './regionGuard';

const deniedPhiAccesses = getAuditLogs({
  allowed: false,
  classification: DataClassification.PHI,
});

log.info(\`Found \${deniedPhiAccesses.length} denied PHI cross-region access attempts\`);
\`\`\`
`;

