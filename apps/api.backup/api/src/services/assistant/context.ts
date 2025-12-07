import { PrismaClient } from '@prisma/client';
import { orgContextService } from './orgContext';

const prisma = new PrismaClient();

export type AssistantType = 'CLINICIAN' | 'RECRUITER' | 'ISSUER' | 'ORG';

export class AssistantContextService {
  /**
   * Build context for a clinician user
   * Includes: profile, credentials, recent applications, and relevant jobs
   */
  async buildClinicianContext(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          credentials: {
            take: 5,
            orderBy: { createdAt: 'desc' },
          },
          applications: {
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
              jobPosting: true,
            },
          },
          continuingEducationTracking: {
            take: 5,
          },
        },
      });

      if (!user) return null;

      // Format the context for the LLM
      return {
        userType: 'CLINICIAN',
        profile: {
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
        },
        credentials: user.credentials.map(c => ({
          type: c.type,
          issuer: c.issuerDid,
          status: c.status,
          issuedAt: c.createdAt,
        })),
        recentApplications: user.applications.map(a => ({
          jobTitle: a.jobPosting.title,
          status: a.status,
          appliedAt: a.createdAt,
        })),
        recentEducation: user.continuingEducationTracking.map(ce => ({
          credits: ce.creditsEarned,
          date: ce.completedAt,
        })),
      };
    } catch (error) {
      console.error('Error building clinician context:', error);
      throw new Error('Failed to build clinician context');
    }
  }

  /**
   * Build context for a recruiter/organization user
   * Includes: organization details, active job postings, recent applicants
   */
  async buildRecruiterContext(userId: string, orgId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) return null;

      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        include: {
          jobPostings: {
            where: { status: 'PUBLISHED' },
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
              _count: {
                select: { applications: true },
              },
            },
          },
          matchImpressions: {
            take: 10,
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!org) return null;

      return {
        userType: 'RECRUITER',
        profile: {
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
        },
        organization: {
          name: org.name,
          industry: org.industry,
        },
        activeJobs: org.jobPostings.map(j => ({
          id: j.id,
          title: j.title,
          applicants: j._count.applications,
          postedAt: j.createdAt,
        })),
        recentMatches: org.matchImpressions.length,
      };
    } catch (error) {
      console.error('Error building recruiter context:', error);
      throw new Error('Failed to build recruiter context');
    }
  }

  /**
   * Build context for an organization/admin user (Credentialing Copilot)
   */
  async buildOrgContext(userId: string, orgId: string) {
    try {
      const orgContext = await orgContextService.buildOrgContext(orgId);

      if (!orgContext) return null;

      return {
        userType: 'ORG' as AssistantType,
        userId,
        ...orgContext
      };
    } catch (error) {
      console.error('Error building org context:', error);
      throw new Error('Failed to build org context');
    }
  }

  /**
   * Build context for an issuer user (VC Review Assistant)
   */
  async buildIssuerContext(userId: string, orgId: string) {
    // Simplified issuer context
    return {
      userType: 'ISSUER' as AssistantType,
      userId,
      orgId,
      role: 'ISSUER_ADMIN',
      capabilities: ['ISSUE_CREDENTIAL', 'REVIEW_APPLICATION', 'REVOKE_CREDENTIAL'],
    };
  }

  /**
   * Merge thread history with domain context to create the prompt
   */
  mergeContext(threadHistory: any[], domainContext: any) {
    let roleDescription = '';
    switch (domainContext.userType) {
      case 'CLINICIAN':
        roleDescription = 'clinicians managing their credentials and career';
        break;
      case 'RECRUITER':
        roleDescription = 'recruiters managing hiring and verification';
        break;
      case 'ORG':
        roleDescription = 'healthcare organizations optimizing credentialing, risk forecasting, and onboarding';
        break;
      case 'ISSUER':
        roleDescription = 'credential issuers reviewing applications and issuing verifiable credentials';
        break;
      default:
        roleDescription = 'users of the VitalCV platform';
    }

    const systemPrompt = `You are VitalCV Assistant, a helpful AI for ${roleDescription}.

    Context:
    ${JSON.stringify(domainContext, null, 2)}

    Answer questions based on the context provided. Be professional, concise, and helpful.`;

    return {
      systemPrompt,
      messages: threadHistory.map(msg => ({
        role: msg.role, // 'user' or 'assistant'
        content: msg.content,
      })),
    };
  }
}

export const assistantContextService = new AssistantContextService();


