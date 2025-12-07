"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDemoMetrics = getDemoMetrics;
exports.getDemoMetricsDetailed = getDemoMetricsDetailed;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
/**
 * Get demo metrics by counting records from demo database tables
 * @returns {Promise<DemoMetrics>} Object with all metric counts
 */
async function getDemoMetrics() {
    try {
        // Run all count queries in parallel for performance
        const [issuedVCs, verifications, privileges, applications, payerEnrollments] = await Promise.all([
            // Count active credentials (issued VCs)
            prisma.credential.count({
                where: {
                    status: 'active'
                }
            }),
            // Count PSV results (verification runs)
            prisma.pSVResult.count(),
            // Count granted privileges
            prisma.privilegeGranted.count({
                where: {
                    status: {
                        in: ['ACTIVE', 'HOLD', 'SUSPENDED']
                    }
                }
            }),
            // Count job applications
            prisma.application.count(),
            // Count payer enrollments (all statuses)
            prisma.payerEnrollment.count()
        ]);
        return {
            issuedVCs,
            verifications,
            privileges,
            applications,
            payerEnrollments
        };
    }
    catch (error) {
        console.error('Error fetching demo metrics:', error);
        // Return zeros on error to ensure API always returns valid data
        return {
            issuedVCs: 0,
            verifications: 0,
            privileges: 0,
            applications: 0,
            payerEnrollments: 0
        };
    }
}
/**
 * Get demo metrics with additional metadata
 * Useful for debugging and understanding data distribution
 */
async function getDemoMetricsDetailed() {
    try {
        const basicMetrics = await getDemoMetrics();
        // Get additional breakdowns
        const [credentialsByType, applicationsByStatus, enrollmentsByStatus, privilegesByStatus] = await Promise.all([
            // Group credentials by type
            prisma.credential.groupBy({
                by: ['type'],
                where: { status: 'active' },
                _count: true
            }),
            // Group applications by status
            prisma.application.groupBy({
                by: ['status'],
                _count: true
            }),
            // Group enrollments by status
            prisma.payerEnrollment.groupBy({
                by: ['status'],
                _count: true
            }),
            // Group privileges by status
            prisma.privilegeGranted.groupBy({
                by: ['status'],
                _count: true
            })
        ]);
        return {
            ...basicMetrics,
            breakdowns: {
                credentialsByType,
                applicationsByStatus,
                enrollmentsByStatus,
                privilegesByStatus
            }
        };
    }
    catch (error) {
        console.error('Error fetching detailed demo metrics:', error);
        return null;
    }
}
