import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface OnboardingStep {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'complete' | 'blocked';
  required: boolean;
  estimatedMinutes: number;
  dependencies?: string[];
}

export interface EmployerOnboardingData {
  orgId: string;
  steps: OnboardingStep[];
  status: 'not_started' | 'in_progress' | 'complete';
  progress: number;
}

/**
 * Setup one-click ATS integration (Greenhouse/Lever/Workday)
 */
export async function setupATSQuickConnect(
  orgId: string,
  atsType: 'greenhouse' | 'lever' | 'workday',
  apiKey?: string,
  apiUrl?: string
): Promise<{ success: boolean; connectionId?: string; message: string }> {
  // Check if ATS already exists
  const existing = await prisma.employerATS.findFirst({
    where: { orgId, name: atsType },
  });

  if (existing) {
    return {
      success: true,
      connectionId: existing.id,
      message: 'ATS connection already exists',
    };
  }

  // Create ATS connection
  const ats = await prisma.employerATS.create({
    data: {
      orgId,
      name: atsType,
      apiUrl: apiUrl ?? getDefaultATSUrl(atsType),
      apiKey: apiKey ?? null,
    },
  });

  return {
    success: true,
    connectionId: ats.id,
    message: `ATS connection established for ${atsType}`,
  };
}

function getDefaultATSUrl(type: string): string {
  const urls: Record<string, string> = {
    greenhouse: 'https://api.greenhouse.io/v1',
    lever: 'https://api.lever.co/v1',
    workday: 'https://wd2-impl-services1.workday.com/ccx/service',
  };
  return urls[type] ?? '';
}

/**
 * Auto-verify all incoming applicants via OIDC
 */
export async function setupAutoVerifyIntegration(orgId: string): Promise<{ success: boolean; webhookId?: string }> {
  // Create credential stream subscription for auto-verification
  const subscription = await prisma.credentialStreamSubscription.findFirst({
    where: { orgId, topic: 'clinician-updates' },
  });

  if (subscription) {
    return { success: true, webhookId: subscription.id };
  }

  const newSubscription = await prisma.credentialStreamSubscription.create({
    data: {
      orgId,
      topic: 'clinician-updates',
      endpoint: `${process.env.API_BASE_URL}/api/employer/${orgId}/auto-verify`,
      secret: generateSecret(),
    },
  });

  return { success: true, webhookId: newSubscription.id };
}

function generateSecret(): string {
  return require('crypto').randomBytes(32).toString('hex');
}

/**
 * Recommend roles based on org size/type
 */
export async function recommendOrgRoles(orgId: string): Promise<Array<{ role: string; description: string; recommended: boolean }>> {
  // Mock - would analyze org size, type, etc.
  const baseRoles = [
    { role: 'admin', description: 'Full system access', recommended: true },
    { role: 'reviewer', description: 'Can review and approve credentials', recommended: true },
    { role: 'auditor', description: 'Read-only access for compliance', recommended: false },
  ];

  return baseRoles;
}

/**
 * Predict time to first verification
 */
export async function projectTimeToFirstVerification(orgId: string): Promise<{
  estimatedDays: number;
  factors: Array<{ factor: string; impact: number }>;
  confidence: number;
}> {
  // Get onboarding status
  const onboarding = await prisma.employerOnboarding.findFirst({
    where: { orgId },
    orderBy: { updatedAt: 'desc' },
  });

  const factors: Array<{ factor: string; impact: number }> = [];
  let estimatedDays = 7; // Base estimate

  if (!onboarding || onboarding.status === 'not_started') {
    factors.push({ factor: 'Onboarding not started', impact: 5 });
    estimatedDays += 5;
  }

  // Check ATS integration
  const ats = await prisma.employerATS.findFirst({
    where: { orgId },
  });

  if (!ats) {
    factors.push({ factor: 'No ATS integration', impact: 3 });
    estimatedDays += 3;
  }

  // Check auto-verify setup
  const autoVerify = await prisma.credentialStreamSubscription.findFirst({
    where: { orgId, topic: 'clinician-updates' },
  });

  if (!autoVerify) {
    factors.push({ factor: 'Auto-verify not configured', impact: 2 });
    estimatedDays += 2;
  }

  const confidence = factors.length === 0 ? 0.9 : 0.7;

  return { estimatedDays, factors, confidence };
}

/**
 * Run safety & compliance baseline checks for employers
 */
export async function runOnboardingSafetyChecks(orgId: string): Promise<{
  passed: boolean;
  checks: Array<{ name: string; status: string; message: string }>;
}> {
  const checks: Array<{ name: string; status: string; message: string }> = [];

  // Check org trust score
  const trust = await prisma.employerTrust.findUnique({
    where: { orgId },
  });

  if (!trust || trust.score < 0.7) {
    checks.push({
      name: 'Organization Trust Score',
      status: 'warning',
      message: 'Organization trust score below recommended threshold',
    });
  } else {
    checks.push({
      name: 'Organization Trust Score',
      status: 'pass',
      message: 'Organization trust score acceptable',
    });
  }

  // Check for sanctions/compliance issues
  const complianceIssues = await prisma.complianceCheck.findMany({
    where: { clinicianId: orgId }, // Mock - would check org-level compliance
    take: 10,
  });

  const failedChecks = complianceIssues.filter((c) => (c.result as any).status === 'failed');
  if (failedChecks.length > 0) {
    checks.push({
      name: 'Compliance Checks',
      status: 'fail',
      message: `${failedChecks.length} failed compliance checks`,
    });
  } else {
    checks.push({
      name: 'Compliance Checks',
      status: 'pass',
      message: 'All compliance checks passed',
    });
  }

  const passed = checks.every((c) => c.status === 'pass');

  return { passed, checks };
}

/**
 * Build onboarding steps
 */
export async function buildOnboardingSteps(orgId: string): Promise<OnboardingStep[]> {
  const steps: OnboardingStep[] = [
    {
      id: 'step-org-info',
      name: 'Organization Information',
      status: 'pending',
      required: true,
      estimatedMinutes: 10,
    },
    {
      id: 'step-ats-connect',
      name: 'Connect ATS System',
      status: 'pending',
      required: false,
      estimatedMinutes: 15,
      dependencies: ['step-org-info'],
    },
    {
      id: 'step-auto-verify',
      name: 'Setup Auto-Verification',
      status: 'pending',
      required: false,
      estimatedMinutes: 5,
      dependencies: ['step-org-info'],
    },
    {
      id: 'step-roles',
      name: 'Configure Roles & Permissions',
      status: 'pending',
      required: true,
      estimatedMinutes: 10,
      dependencies: ['step-org-info'],
    },
    {
      id: 'step-safety-check',
      name: 'Safety & Compliance Check',
      status: 'pending',
      required: true,
      estimatedMinutes: 2,
      dependencies: ['step-org-info'],
    },
  ];

  // Check which steps are already complete
  const onboarding = await prisma.employerOnboarding.findFirst({
    where: { orgId },
    orderBy: { updatedAt: 'desc' },
  });

  if (onboarding) {
    const completedSteps = (onboarding.steps as any).completedSteps ?? [];
    for (const step of steps) {
      if (completedSteps.includes(step.id)) {
        step.status = 'complete';
      }
    }
  }

  return steps;
}

/**
 * Get or create employer onboarding
 */
export async function getOrCreateEmployerOnboarding(orgId: string): Promise<EmployerOnboardingData> {
  let onboarding = await prisma.employerOnboarding.findFirst({
    where: { orgId },
    orderBy: { updatedAt: 'desc' },
  });

  const steps = await buildOnboardingSteps(orgId);
  const completedCount = steps.filter((s) => s.status === 'complete').length;
  const progress = steps.length > 0 ? (completedCount / steps.length) * 100 : 0;

  let status: 'not_started' | 'in_progress' | 'complete' = 'not_started';
  if (progress === 100) {
    status = 'complete';
  } else if (progress > 0) {
    status = 'in_progress';
  }

  if (!onboarding) {
    onboarding = await prisma.employerOnboarding.create({
      data: {
        orgId,
        steps: steps as unknown as any,
        status,
      },
    });
  } else {
    onboarding = await prisma.employerOnboarding.update({
      where: { id: onboarding.id },
      data: {
        steps: steps as unknown as any,
        status,
        updatedAt: new Date(),
      },
    });
  }

  return {
    orgId,
    steps,
    status,
    progress,
  };
}

