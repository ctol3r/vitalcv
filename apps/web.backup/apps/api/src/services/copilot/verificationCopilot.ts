import { PrismaClient } from '@prisma/client';
import { ChainClient } from '../chain/client';

const prisma = new PrismaClient();
const chainClient = new ChainClient();

export interface CopilotContext {
  userId: string;
  role: 'issuer' | 'verifier' | 'clinician';
  currentStep?: string;
  completedSteps: string[];
  contextData: Record<string, unknown>;
  sessionId: string;
  updatedAt: string;
}

/**
 * Task 279.2 — Context-aware credential explainer
 * Explain credential meaning → user role
 */
export async function explainCredential(
  userId: string,
  credentialId: string,
  role: 'issuer' | 'verifier' | 'clinician',
): Promise<{ explanation: string; keyFields: string[]; actions: string[] }> {
  const credential = await prisma.walletCredential.findUnique({
    where: { credentialId },
  });

  if (!credential) {
    return {
      explanation: 'Credential not found',
      keyFields: [],
      actions: [],
    };
  }

  let explanation = '';
  const keyFields: string[] = [];
  const actions: string[] = [];

  switch (role) {
    case 'clinician':
      explanation = `This is your ${credential.type} credential. It verifies your professional qualifications and can be shared with employers.`;
      keyFields.push('Type', 'Issued Date', 'Status');
      actions.push('View details', 'Share with employer', 'Export PDF');
      break;
    case 'verifier':
      explanation = `This credential verifies the clinician's ${credential.type}. Check the issuer, issue date, and revocation status.`;
      keyFields.push('Issuer', 'Issue Date', 'Revocation Status', 'Chain Proof');
      actions.push('Verify on-chain', 'Check issuer trust', 'Validate signature');
      break;
    case 'issuer':
      explanation = `You issued this ${credential.type} credential. Monitor its status and revocation state.`;
      keyFields.push('Recipient', 'Issue Date', 'Revocation Status');
      actions.push('View recipient', 'Revoke if needed', 'Export audit log');
      break;
  }

  return {
    explanation,
    keyFields,
    actions,
  };
}

/**
 * Task 279.3 — Issuer-side copilot workflows
 * Walk issuers through issuing VCs safely
 */
export async function guideIssuerWorkflow(
  userId: string,
  step: 'start' | 'verify' | 'issue' | 'confirm',
): Promise<{ instruction: string; nextStep?: string; warnings?: string[] }> {
  const context = await getOrCreateContext(userId);

  switch (step) {
    case 'start':
      return {
        instruction: 'Begin by verifying the clinician\'s identity and credentials. Check their NPI and license status.',
        nextStep: 'verify',
        warnings: ['Ensure all documents are valid', 'Check for any sanctions'],
      };
    case 'verify':
      return {
        instruction: 'Review the credential details. Verify the information matches the source documents.',
        nextStep: 'issue',
        warnings: ['Double-check all fields before issuing'],
      };
    case 'issue':
      return {
        instruction: 'Issue the credential. This will create an on-chain record.',
        nextStep: 'confirm',
        warnings: ['This action cannot be easily undone'],
      };
    case 'confirm':
      return {
        instruction: 'Credential issued successfully. The clinician can now use it.',
        warnings: ['Monitor for any revocation needs'],
      };
    default:
      return {
        instruction: 'Unknown step',
      };
  }
}

/**
 * Task 279.4 — Verifier-side copilot workflows
 * Guide verifiers through proof validation
 */
export async function guideVerifierWorkflow(
  userId: string,
  step: 'receive' | 'validate' | 'check' | 'approve',
): Promise<{ instruction: string; nextStep?: string; checks: string[] }> {
  const context = await getOrCreateContext(userId);

  switch (step) {
    case 'receive':
      return {
        instruction: 'You received a credential for verification. Review the credential type and issuer.',
        nextStep: 'validate',
        checks: ['Check credential type', 'Verify issuer identity'],
      };
    case 'validate':
      return {
        instruction: 'Validate the credential on-chain. Check the proof and revocation status.',
        nextStep: 'check',
        checks: ['Verify on-chain proof', 'Check revocation list', 'Validate issuer signature'],
      };
    case 'check':
      return {
        instruction: 'Check the credential details match your requirements. Verify expiration and status.',
        nextStep: 'approve',
        checks: ['Match credential to requirements', 'Check expiration date', 'Verify status'],
      };
    case 'approve':
      return {
        instruction: 'Credential verified successfully. You can proceed with the application.',
        checks: ['Record verification', 'Update application status'],
      };
    default:
      return {
        instruction: 'Unknown step',
        checks: [],
      };
  }
}

/**
 * Task 279.6 — Compliance question interpreter
 * Answer compliance questions using rules engine
 */
export async function answerComplianceQuestion(
  userId: string,
  question: string,
): Promise<{ answer: string; sources: string[]; confidence: number }> {
  const questionLower = question.toLowerCase();
  let answer = '';
  const sources: string[] = [];
  let confidence = 0.7;

  if (questionLower.includes('license') && questionLower.includes('expired')) {
    answer = 'If a license is expired, the clinician cannot practice legally. They must renew before providing care.';
    sources.push('State Medical Board Regulations');
    confidence = 0.9;
  } else if (questionLower.includes('sanction')) {
    answer = 'Sanctions are serious compliance issues. Check the NPDB and state board records for details.';
    sources.push('NPDB Database', 'State Board Records');
    confidence = 0.85;
  } else if (questionLower.includes('compact')) {
    answer = 'Compact licenses allow practice across member states. Verify the clinician\'s home state and compact membership.';
    sources.push('Nurse Licensure Compact', 'Physician Compact');
    confidence = 0.8;
  } else {
    answer = 'I can help with license status, sanctions, compacts, and credential verification. Please ask a more specific question.';
    confidence = 0.5;
  }

  return {
    answer,
    sources,
    confidence,
  };
}

/**
 * Task 279.7 — Safety flag explainer
 * Explain safety/sanction events clearly
 */
export async function explainSafetyFlag(
  userId: string,
  flagType: string,
  severity: string,
): Promise<{ explanation: string; impact: string; actions: string[] }> {
  let explanation = '';
  let impact = '';
  const actions: string[] = [];

  switch (flagType) {
    case 'sanction':
      explanation = 'A sanction has been placed on this clinician by a regulatory board.';
      impact = 'This prevents or restricts the clinician from practicing.';
      actions.push('Review sanction details', 'Contact regulatory board', 'Suspend privileges if needed');
      break;
    case 'license_expired':
      explanation = 'The clinician\'s license has expired.';
      impact = 'They cannot practice legally until the license is renewed.';
      actions.push('Check renewal status', 'Suspend practice', 'Request renewal documentation');
      break;
    case 'credential_mismatch':
      explanation = 'There is a mismatch between credential information and source records.';
      impact = 'This may indicate data quality issues or potential fraud.';
      actions.push('Verify source documents', 'Contact issuer', 'Request clarification');
      break;
    default:
      explanation = `A ${flagType} safety flag has been detected.`;
      impact = 'Review the details to understand the impact.';
      actions.push('Review flag details', 'Contact support if needed');
  }

  return {
    explanation,
    impact,
    actions,
  };
}

/**
 * Task 279.8 — Resume/continue context engine
 * Persist AI context across pages
 */
export async function saveCopilotContext(
  userId: string,
  contextData: Partial<CopilotContext>,
): Promise<void> {
  const existing = await prisma.verificationCopilot.findUnique({
    where: { userId },
  });

  const currentContext = existing
    ? (existing.context as CopilotContext)
    : {
        userId,
        role: 'clinician' as const,
        completedSteps: [],
        contextData: {},
        sessionId: `session_${Date.now()}`,
        updatedAt: new Date().toISOString(),
      };

  const updatedContext: CopilotContext = {
    ...currentContext,
    ...contextData,
    updatedAt: new Date().toISOString(),
  };

  await prisma.verificationCopilot.upsert({
    where: { userId },
    create: {
      userId,
      context: updatedContext as any,
    },
    update: {
      context: updatedContext as any,
    },
  });
}

export async function getCopilotContext(userId: string): Promise<CopilotContext | null> {
  const copilot = await prisma.verificationCopilot.findUnique({
    where: { userId },
  });

  if (!copilot) {
    return null;
  }

  return copilot.context as CopilotContext;
}

async function getOrCreateContext(userId: string): Promise<CopilotContext> {
  const existing = await getCopilotContext(userId);

  if (existing) {
    return existing;
  }

  const newContext: CopilotContext = {
    userId,
    role: 'clinician',
    completedSteps: [],
    contextData: {},
    sessionId: `session_${Date.now()}`,
    updatedAt: new Date().toISOString(),
  };

  await saveCopilotContext(userId, newContext);

  return newContext;
}

/**
 * Task 279.10 — Anchor copilot state snapshot
 */
export async function anchorCopilotState(userId: string): Promise<string | null> {
  try {
    const copilot = await prisma.verificationCopilot.findUnique({
      where: { userId },
    });

    if (!copilot) {
      return null;
    }

    const context = copilot.context as CopilotContext;

    const receipt = await chainClient.submitAuditEvent({
      eventType: 'verificationCopilotAnchored',
      payload: {
        userId,
        role: context.role,
        completedSteps: context.completedSteps.length,
        sessionId: context.sessionId,
      },
    });

    return receipt.txHash;
  } catch (error) {
    console.error('[VerificationCopilot] Failed to anchor state', error);
    return null;
  }
}

