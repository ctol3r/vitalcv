export interface ShiftAssignmentContext {
  assignmentId: string;
  shiftId: string;
  clinicianId: string;
  orgId: string;
  role?: string;
  readinessScore?: number;
  requestedBy?: string;
  metadata?: Record<string, unknown>;
}

export interface ProvisioningStepResult {
  name: string;
  status: 'pending' | 'completed' | 'skipped';
  referenceId?: string;
  details?: string;
  startedAt: string;
  completedAt?: string;
}

export interface ProvisioningResult {
  assignmentId: string;
  steps: ProvisioningStepResult[];
  completed: boolean;
  emittedAt: string;
}

/**
 * Stub integration that simulates EHR, dictation, and badge provisioning.
 * This is intentionally synchronous so callers can hook into future webhooks.
 */
export async function provisionShiftAccess(
  context: ShiftAssignmentContext,
): Promise<ProvisioningResult> {
  const now = new Date();
  const steps: ProvisioningStepResult[] = [];

  steps.push(buildStep('EHR Account Create', {
    referenceId: `ehr-${context.assignmentId}`,
    details: `Provisioned in ${context.orgId} for role ${context.role ?? 'GENERAL'}`,
  }));

  steps.push(buildStep('Dictation Profile Sync', {
    referenceId: `dict-${context.clinicianId}`,
    details: 'Default Dragon profile initialized',
  }));

  steps.push(buildStep('Badge Provisioning', {
    referenceId: `badge-${context.assignmentId}`,
    details: '24-hour access badge requested',
  }));

  const result: ProvisioningResult = {
    assignmentId: context.assignmentId,
    steps,
    completed: steps.every((step) => step.status === 'completed'),
    emittedAt: now.toISOString(),
  };

  return result;
}

function buildStep(
  name: string,
  overrides: Partial<ProvisioningStepResult>,
): ProvisioningStepResult {
  const startedAt = new Date();
  const completedAt = new Date(startedAt.getTime() + 250);
  return {
    name,
    status: 'completed',
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    ...overrides,
  };
}










