import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class OrgContextService {
  /**
   * Build comprehensive organization context for the Credentialing Copilot
   */
  async buildOrgContext(orgId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        jobPostings: {
          where: { status: 'PUBLISHED' },
          include: {
            applications: {
              include: {
                user: {
                  include: {
                    credentials: true,
                  },
                },
              },
            },
          },
        },
        matchImpressions: true,
      },
    });

    if (!org) return null;

    // 1. Org History & Patterns
    const history = await this.getOrgHistory(orgId);

    // 2. Credential Patterns (from successful hires/verifications)
    const credentialPatterns = await this.analyzeCredentialPatterns(orgId);

    // 3. Common Verification Failures
    const verificationFailures = await this.getCommonVerificationFailures(orgId);

    // 4. Past Compliance Flags
    const complianceFlags = await this.getComplianceFlags(orgId);

    // 5. Job Match Patterns
    const matchPatterns = this.analyzeMatchPatterns(org.matchImpressions);

    return {
      orgId,
      name: org.name,
      history,
      credentialPatterns,
      verificationFailures,
      complianceFlags,
      matchPatterns,
      activeJobs: org.jobPostings.map(j => ({
        id: j.id,
        title: j.title,
        applicantCount: j.applications.length,
      })),
    };
  }

  private async getOrgHistory(orgId: string) {
    // Mock implementation - would query historical data
    return {
      totalHires: 150,
      avgTimeToHire: 14, // days
      verificationSuccessRate: 0.92,
    };
  }

  private async analyzeCredentialPatterns(orgId: string) {
    // Analyze which credentials are most common among successful applicants
    return {
      required: ['Medical License', 'BLS Certification'],
      preferred: ['ACLS', 'PALS'],
      topIssuers: ['State Medical Board', 'American Heart Association'],
    };
  }

  private async getCommonVerificationFailures(orgId: string) {
    // Query audit logs or verification records for failures
    return [
      { reason: 'License Expired', frequency: 'High' },
      { reason: 'Name Mismatch', frequency: 'Medium' },
    ];
  }

  private async getComplianceFlags(orgId: string) {
    // Query compliance service for active or past flags
    return [
      { type: 'License Expiration Warning', count: 3, riskLevel: 'Medium' },
    ];
  }

  private analyzeMatchPatterns(impressions: any[]) {
    // Analyze what profiles the org engages with
    return {
      favoredSpecialties: ['Emergency Medicine', 'Critical Care'],
      responseTime: 'Active', // < 24h
    };
  }
}

export const orgContextService = new OrgContextService();


