/**
 * B240A-VM-003: VendorOnboardingFlow model
 *
 * Defines steps for vendor onboarding: id, vendorId, currentStep, status,
 * checklist (JSON), createdAt, updatedAt
 */

import { PrismaClient, OnboardingStatus } from '@prisma/client';

export interface ChecklistItem {
  id: string;
  step: string;
  title: string;
  description?: string;
  completed: boolean;
  completedAt?: Date;
  assignedTo?: string;
  notes?: string;
}

export interface VendorOnboardingFlowInput {
  vendorId: string;
  currentStep?: string;
  status?: OnboardingStatus;
  checklist?: ChecklistItem[];
}

export interface VendorOnboardingFlow {
  id: string;
  vendorId: string;
  currentStep: string;
  status: OnboardingStatus;
  checklist: ChecklistItem[] | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate onboarding flow input
 */
export function validateOnboardingFlowInput(input: VendorOnboardingFlowInput): void {
  if (!input.vendorId || input.vendorId.trim().length === 0) {
    throw new Error('vendorId is required');
  }
}

/**
 * Create vendor onboarding flow
 */
export async function createVendorOnboardingFlow(
  prisma: PrismaClient,
  input: VendorOnboardingFlowInput
): Promise<VendorOnboardingFlow> {
  validateOnboardingFlowInput(input);

  // Verify vendor exists
  const vendor = await prisma.vendor.findUnique({
    where: { id: input.vendorId },
  });
  if (!vendor) {
    throw new Error(`Vendor with id ${input.vendorId} not found`);
  }

  return prisma.vendorOnboardingFlow.create({
    data: {
      vendorId: input.vendorId,
      currentStep: input.currentStep || 'initial',
      status: input.status || OnboardingStatus.NOT_STARTED,
      checklist: input.checklist ? (input.checklist as any) : null,
    },
  });
}

/**
 * Get onboarding flow by vendor ID
 */
export async function getVendorOnboardingFlow(
  prisma: PrismaClient,
  vendorId: string
): Promise<VendorOnboardingFlow | null> {
  return prisma.vendorOnboardingFlow.findUnique({
    where: { vendorId },
  });
}

/**
 * Update onboarding flow
 */
export async function updateVendorOnboardingFlow(
  prisma: PrismaClient,
  vendorId: string,
  updates: Partial<VendorOnboardingFlowInput>
): Promise<VendorOnboardingFlow> {
  return prisma.vendorOnboardingFlow.update({
    where: { vendorId },
    data: {
      ...(updates.currentStep && { currentStep: updates.currentStep }),
      ...(updates.status && { status: updates.status }),
      ...(updates.checklist !== undefined && { checklist: updates.checklist ? (updates.checklist as any) : null }),
    },
  });
}

/**
 * Update onboarding step
 */
export async function updateOnboardingStep(
  prisma: PrismaClient,
  vendorId: string,
  step: string,
  status?: OnboardingStatus
): Promise<VendorOnboardingFlow> {
  return prisma.vendorOnboardingFlow.update({
    where: { vendorId },
    data: {
      currentStep: step,
      ...(status && { status }),
    },
  });
}

/**
 * Mark checklist item as completed
 */
export async function completeChecklistItem(
  prisma: PrismaClient,
  vendorId: string,
  itemId: string,
  notes?: string
): Promise<VendorOnboardingFlow> {
  const flow = await prisma.vendorOnboardingFlow.findUnique({
    where: { vendorId },
  });

  if (!flow) {
    throw new Error(`Onboarding flow for vendor ${vendorId} not found`);
  }

  const checklist = (flow.checklist as ChecklistItem[]) || [];
  const updatedChecklist = checklist.map((item) => {
    if (item.id === itemId) {
      return {
        ...item,
        completed: true,
        completedAt: new Date(),
        ...(notes && { notes }),
      };
    }
    return item;
  });

  return prisma.vendorOnboardingFlow.update({
    where: { vendorId },
    data: {
      checklist: updatedChecklist as any,
    },
  });
}

/**
 * Delete onboarding flow
 */
export async function deleteVendorOnboardingFlow(
  prisma: PrismaClient,
  vendorId: string
): Promise<void> {
  await prisma.vendorOnboardingFlow.delete({
    where: { vendorId },
  });
}

