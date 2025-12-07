/**
 * B240B-VM-016: Complaint Handling Service
 *
 * Manages investigation workflow and resolution for vendor complaints.
 */

import { PrismaClient, ComplaintStatus, ComplaintSeverity } from '@prisma/client';
import {
  createComplaint,
  updateComplaintStatus,
  getComplaint,
  getVendorComplaints,
} from '../models/VendorComplaint';

export interface InvestigationStep {
  step: string;
  completed: boolean;
  completedAt?: Date;
  notes?: string;
  assignedTo?: string;
}

export interface InvestigationWorkflow {
  complaintId: string;
  steps: InvestigationStep[];
  status: 'not_started' | 'in_progress' | 'completed';
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Create complaint and initiate investigation workflow
 */
export async function createComplaintWithInvestigation(
  prisma: PrismaClient,
  input: {
    vendorId: string;
    reporterId: string;
    description: string;
    severity?: ComplaintSeverity;
  }
): Promise<{
  complaint: any;
  investigation: InvestigationWorkflow;
}> {
  // Create complaint
  const complaint = await createComplaint(prisma, input);

  // Create investigation workflow based on severity
  const investigation = await createInvestigationWorkflow(
    prisma,
    complaint.id,
    complaint.severity
  );

  return { complaint, investigation };
}

/**
 * Create investigation workflow for a complaint
 */
async function createInvestigationWorkflow(
  prisma: PrismaClient,
  complaintId: string,
  severity: ComplaintSeverity
): Promise<InvestigationWorkflow> {
  // Define investigation steps based on severity
  const steps: InvestigationStep[] = [];

  if (severity === ComplaintSeverity.CRITICAL || severity === ComplaintSeverity.HIGH) {
    steps.push(
      { step: 'immediate_review', completed: false },
      { step: 'vendor_notification', completed: false },
      { step: 'evidence_collection', completed: false },
      { step: 'root_cause_analysis', completed: false },
      { step: 'remediation_plan', completed: false },
      { step: 'resolution_verification', completed: false }
    );
  } else {
    steps.push(
      { step: 'initial_review', completed: false },
      { step: 'vendor_contact', completed: false },
      { step: 'resolution_plan', completed: false },
      { step: 'follow_up', completed: false }
    );
  }

  // Store workflow in complaint metadata (or separate table in production)
  // For now, we'll track it via status updates

  return {
    complaintId,
    steps,
    status: 'not_started',
  };
}

/**
 * Update investigation step
 */
export async function updateInvestigationStep(
  prisma: PrismaClient,
  complaintId: string,
  stepName: string,
  completed: boolean,
  notes?: string,
  assignedTo?: string
): Promise<void> {
  const complaint = await getComplaint(prisma, complaintId);
  if (!complaint) {
    throw new Error(`Complaint ${complaintId} not found`);
  }

  // Update complaint status based on investigation progress
  if (complaint.status === ComplaintStatus.OPEN && completed) {
    await updateComplaintStatus(prisma, complaintId, ComplaintStatus.INVESTIGATING);
  }

  // In production, store investigation steps in a separate table
  // For now, we'll use the resolutionNotes field to track progress
  const currentNotes = complaint.resolutionNotes || '';
  const stepNote = `[${new Date().toISOString()}] ${stepName}: ${completed ? 'completed' : 'in progress'}${notes ? ` - ${notes}` : ''}\n`;
  await prisma.vendorComplaint.update({
    where: { id: complaintId },
    data: {
      resolutionNotes: currentNotes + stepNote,
    },
  });
}

/**
 * Resolve complaint
 */
export async function resolveComplaint(
  prisma: PrismaClient,
  complaintId: string,
  resolutionNotes: string
): Promise<any> {
  return updateComplaintStatus(
    prisma,
    complaintId,
    ComplaintStatus.RESOLVED,
    resolutionNotes
  );
}

/**
 * Close complaint
 */
export async function closeComplaint(
  prisma: PrismaClient,
  complaintId: string,
  finalNotes?: string
): Promise<any> {
  return updateComplaintStatus(
    prisma,
    complaintId,
    ComplaintStatus.CLOSED,
    finalNotes
  );
}

/**
 * Get active investigations
 */
export async function getActiveInvestigations(
  prisma: PrismaClient
): Promise<Array<{
  complaint: any;
  daysOpen: number;
}>> {
  const complaints = await prisma.vendorComplaint.findMany({
    where: {
      status: {
        in: [ComplaintStatus.OPEN, ComplaintStatus.INVESTIGATING],
      },
    },
    orderBy: { date: 'asc' },
  });

  const now = new Date();
  return complaints.map((complaint) => {
    const daysOpen = Math.floor(
      (now.getTime() - complaint.date.getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      complaint,
      daysOpen,
    };
  });
}

/**
 * Get complaints requiring attention (high severity, open for >7 days)
 */
export async function getComplaintsRequiringAttention(
  prisma: PrismaClient
): Promise<any[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return prisma.vendorComplaint.findMany({
    where: {
      status: {
        in: [ComplaintStatus.OPEN, ComplaintStatus.INVESTIGATING],
      },
      severity: {
        in: [ComplaintSeverity.HIGH, ComplaintSeverity.CRITICAL],
      },
      date: { lte: sevenDaysAgo },
    },
    orderBy: [
      { severity: 'desc' },
      { date: 'asc' },
    ],
  });
}

