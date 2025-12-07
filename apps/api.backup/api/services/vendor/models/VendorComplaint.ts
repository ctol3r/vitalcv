/**
 * B240B-VM-016: VendorComplaint model
 *
 * Tracks complaints against vendors with severity and status tracking.
 */

import { PrismaClient, ComplaintSeverity, ComplaintStatus } from '@prisma/client';

export interface ComplaintInput {
  vendorId: string;
  reporterId: string;
  description: string;
  severity?: ComplaintSeverity;
  date?: Date;
}

export interface Complaint {
  id: string;
  vendorId: string;
  reporterId: string;
  date: Date;
  description: string;
  severity: ComplaintSeverity;
  status: ComplaintStatus;
  resolutionDate: Date | null;
  resolutionNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a new complaint
 */
export async function createComplaint(
  prisma: PrismaClient,
  input: ComplaintInput
): Promise<Complaint> {
  return prisma.vendorComplaint.create({
    data: {
      vendorId: input.vendorId,
      reporterId: input.reporterId,
      description: input.description,
      severity: input.severity ?? ComplaintSeverity.MEDIUM,
      date: input.date ?? new Date(),
    },
  });
}

/**
 * Get complaint by ID
 */
export async function getComplaint(
  prisma: PrismaClient,
  id: string
): Promise<Complaint | null> {
  return prisma.vendorComplaint.findUnique({
    where: { id },
  });
}

/**
 * Get complaints for a vendor
 */
export async function getVendorComplaints(
  prisma: PrismaClient,
  vendorId: string,
  options?: {
    status?: ComplaintStatus;
    severity?: ComplaintSeverity;
    limit?: number;
  }
): Promise<Complaint[]> {
  return prisma.vendorComplaint.findMany({
    where: {
      vendorId,
      ...(options?.status && { status: options.status }),
      ...(options?.severity && { severity: options.severity }),
    },
    orderBy: { date: 'desc' },
    take: options?.limit,
  });
}

/**
 * Update complaint status
 */
export async function updateComplaintStatus(
  prisma: PrismaClient,
  id: string,
  status: ComplaintStatus,
  resolutionNotes?: string
): Promise<Complaint> {
  const updateData: any = {
    status,
    ...(status === ComplaintStatus.RESOLVED || status === ComplaintStatus.CLOSED
      ? { resolutionDate: new Date() }
      : {}),
    ...(resolutionNotes && { resolutionNotes }),
  };

  return prisma.vendorComplaint.update({
    where: { id },
    data: updateData,
  });
}

/**
 * Get complaints by reporter
 */
export async function getComplaintsByReporter(
  prisma: PrismaClient,
  reporterId: string
): Promise<Complaint[]> {
  return prisma.vendorComplaint.findMany({
    where: { reporterId },
    orderBy: { date: 'desc' },
  });
}

