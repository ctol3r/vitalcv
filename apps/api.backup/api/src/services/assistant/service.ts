import { assistantContextService, AssistantType } from './context';

export interface AssistantQueryOptions {
  userId: string;
  orgId?: string;
  threadId?: string;
  message: string;
  history?: any[];
  assistantType?: AssistantType;
}

export class AssistantService {

  async processQuery(options: AssistantQueryOptions) {
    const { userId, orgId, threadId, message, history = [], assistantType } = options;

    // 1. Determine Context Type
    let context;
    let type = assistantType;

    if (!type) {
      // Infer type if not provided
      if (orgId) type = 'RECRUITER'; // Default to recruiter if org present but no specific type
      else type = 'CLINICIAN';
    }

    // 2. Build Context
    switch (type) {
      case 'CLINICIAN':
        context = await assistantContextService.buildClinicianContext(userId);
        break;
      case 'RECRUITER':
        if (orgId) context = await assistantContextService.buildRecruiterContext(userId, orgId);
        break;
      case 'ORG':
        if (orgId) context = await assistantContextService.buildOrgContext(userId, orgId);
        break;
      case 'ISSUER':
        if (orgId) context = await assistantContextService.buildIssuerContext(userId, orgId);
        break;
      default:
        throw new Error(`Unsupported assistant type: ${type}`);
    }

    if (!context) {
      throw new Error('Failed to build context');
    }

    // 3. Prepare LLM Input
    const threadHistory = [
      ...history,
      { role: 'user', content: message }
    ];

    const llmInput = assistantContextService.mergeContext(threadHistory, context);

    // 4. Call LLM
    const aiResponse = await this.mockLLMCall(llmInput, type || 'CLINICIAN');

    return {
      threadId: threadId || `thread_${Date.now()}`,
      message: aiResponse,
      contextUsed: true,
    };
  }

  /**
   * VC Review Assistant: Review a credential application
   */
  async reviewApplication(applicationId: string, userId: string, orgId: string) {
    // Mock fetching application data
    const applicationData = {
        id: applicationId,
        applicantName: "Dr. Jane Smith",
        credentialType: "Medical License",
        documents: ["license_scan.pdf", "board_cert.pdf"],
        issues: []
    };

    // In a real implementation, we'd analyze the documents here.

    const suggestion = {
        summary: "Application appears complete. Medical license is valid and active. Board certification matches requirement.",
        flags: [], // No issues found
        recommendation: "APPROVE",
        confidence: 0.98,
        autoFill: {
            approvalReason: "All documents verified and valid.",
            expirationDate: "2026-12-31",
            restrictions: "None"
        }
    };

    return suggestion;
  }


  private async mockLLMCall(input: any, userType: string): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 800)); // Simulate latency

    const userMessage = input.messages[input.messages.length - 1].content.toLowerCase();

    // ORG Mode Responses (Copilot)
    if (userType === 'ORG') {
        if (userMessage.includes('analyze') || userMessage.includes('pool')) {
            return "I've analyzed the clinician pool. 85% are fully verified. I detected a potential risk with 3 clinicians whose licenses expire in < 30 days. Would you like to flag them?";
        }
        if (userMessage.includes('predict') || userMessage.includes('delay')) {
            return "Based on current patterns, I predict delays in the 'Emergency Medicine' verification queue due to high volume at the State Board. Expect a 3-day lag.";
        }
        if (userMessage.includes('suggest') || userMessage.includes('improvement')) {
            return "Optimization Suggestion: You could reduce onboarding time by 15% by enabling 'Auto-Verify' for BLS certifications, which have a 99% pass rate.";
        }
        if (userMessage.includes('risk')) {
             return "Risk Forecast: 2 providers have mal-practice history flags in the last 5 years that require manual review.";
        }
    }

    // ISSUER Mode Responses
    if (userType === 'ISSUER') {
        if (userMessage.includes('review')) {
            return "I've reviewed the application. Documents appear valid. However, the expiry date on the primary license is close (3 months). Recommendation: Approve with Note.";
        }
    }

    // Fallback to original simple logic
    if (userMessage.includes('credential') || userMessage.includes('license')) {
      if (userType === 'CLINICIAN') {
        return "I can see your credentials. It looks like your Medical License is active. Do you need help adding a new one?";
      } else {
        return "You can verify candidate credentials in the Verification tab. Would you like to see recent verifications?";
      }
    }

    if (userMessage.includes('job') || userMessage.includes('application')) {
      if (userType === 'CLINICIAN') {
        return "You have 2 pending applications. 'Senior Nurse' at General Hospital hasn't updated yet.";
      } else {
        return "Your 'Senior Nurse' posting has 5 new applicants today. Shall I summarize them?";
      }
    }

    return `I'm the VitalCV Credentialing Copilot (${userType}). I can help with analysis, risk forecasting, and verification reviews. How can I assist?`;
  }
}

export const assistantService = new AssistantService();


