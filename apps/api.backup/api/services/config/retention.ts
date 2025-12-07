/**
 * S72-POST-2A-009: Data retention policy constants
 *
 * Defines retention periods for logs and demo data.
 * Not yet enforced but documented for future implementation.
 */

/**
 * Demo data retention period in days
 * Demo data should be retained for a shorter period than production data
 */
export const DEMO_RETENTION_DAYS = 90; // 90 days for demo environments

/**
 * Production data retention period in days
 * Production data may need to be retained longer for compliance/audit
 */
export const PROD_RETENTION_DAYS = 365; // 1 year for production environments

/**
 * Log retention period in days
 * Logs may need to be retained longer for debugging and compliance
 */
export const LOG_RETENTION_DAYS = 180; // 180 days for logs

/**
 * Audit event retention period in days
 * Audit events should be retained longer for compliance
 */
export const AUDIT_RETENTION_DAYS = 730; // 2 years for audit events

/**
 * Temporary data retention period in days
 * Temporary data (e.g., uploads, caches) should be cleaned up quickly
 */
export const TEMP_RETENTION_DAYS = 7; // 7 days for temporary data

/**
 * Get retention period based on environment
 * @param isDemo Whether this is a demo environment
 * @returns Retention period in days
 */
export function getRetentionDays(isDemo: boolean = false): number {
  return isDemo ? DEMO_RETENTION_DAYS : PROD_RETENTION_DAYS;
}

/**
 * Get retention cutoff date
 * @param retentionDays Number of days to retain
 * @returns Date before which data should be deleted
 */
export function getRetentionCutoffDate(retentionDays: number): Date {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  return cutoffDate;
}

/**
 * Check if a date is within retention period
 * @param date Date to check
 * @param retentionDays Number of days to retain
 * @returns true if date is within retention period
 */
export function isWithinRetention(date: Date, retentionDays: number): boolean {
  const cutoffDate = getRetentionCutoffDate(retentionDays);
  return date >= cutoffDate;
}

/**
 * TODO: S72-POST-2A-009
 *
 * Future implementation should include:
 * 1. Scheduled job to clean up expired data
 * 2. Data retention policy enforcement
 * 3. Audit logging for data deletion
 * 4. Compliance reporting for retention policies
 *
 * Example cleanup job:
 * ```typescript
 * async function cleanupExpiredData() {
 *   const cutoffDate = getRetentionCutoffDate(DEMO_RETENTION_DAYS);
 *
 *   // Delete expired demo data
 *   await prisma.application.deleteMany({
 *     where: {
 *       createdAt: { lt: cutoffDate },
 *       // Add demo flag check if needed
 *     },
 *   });
 *
 *   // Delete expired logs
 *   const logCutoffDate = getRetentionCutoffDate(LOG_RETENTION_DAYS);
 *   await prisma.auditEvent.deleteMany({
 *     where: {
 *       createdAt: { lt: logCutoffDate },
 *     },
 *   });
 * }
 * ```
 */

