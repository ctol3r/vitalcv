/**
 * S72-D3-C-001: Demo metrics service
 *
 * Queries demo DB tables for simple counts and returns metrics for exec dashboard:
 * - issuedVCs: Count of issued credentials
 * - verifications: Count of PSV results
 * - privileges: Count of granted privileges
 * - applications: Count of job applications
 * - payerEnrollments: Count of payer enrollments
 */
export interface DemoMetrics {
    issuedVCs: number;
    verifications: number;
    privileges: number;
    applications: number;
    payerEnrollments: number;
}
/**
 * Get demo metrics by counting records from demo database tables
 * @returns {Promise<DemoMetrics>} Object with all metric counts
 */
export declare function getDemoMetrics(): Promise<DemoMetrics>;
/**
 * Get demo metrics with additional metadata
 * Useful for debugging and understanding data distribution
 */
export declare function getDemoMetricsDetailed(): Promise<{
    breakdowns: {
        credentialsByType: any;
        applicationsByStatus: any;
        enrollmentsByStatus: any;
        privilegesByStatus: any;
    };
    issuedVCs: number;
    verifications: number;
    privileges: number;
    applications: number;
    payerEnrollments: number;
} | null>;
