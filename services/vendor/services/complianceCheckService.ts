/**
 * B240B-VM-013: Compliance Check Service
 *
 * Verifies vendor compliance with required certifications, licenses, and policies.
 * Checks expiry dates, retrieves documents from DocumentStorage, and flags non-compliance.
 */

import { PrismaClient, DocumentType } from '@prisma/client';

export interface ComplianceRequirement {
  type: string; // e.g., "ISO_27001", "HIPAA", "SOC2", "license"
  required: boolean;
  expiryCheck?: boolean; // Whether to check expiry dates
  documentType?: DocumentType;
}

export interface ComplianceCheckResult {
  vendorId: string;
  compliant: boolean;
  requirements: Array<{
    type: string;
    status: 'compliant' | 'non_compliant' | 'expired' | 'missing' | 'pending';
    expiryDate?: Date;
    documentId?: string;
    notes?: string;
  }>;
  checkedAt: Date;
}

/**
 * Interface for document storage service
 * In production, this would be a real DocumentStorage service
 */
interface DocumentStorageService {
  getDocument(documentId: string): Promise<{
    id: string;
    expiryDate?: Date;
    metadata?: any;
  } | null>;
  listDocuments(vendorId: string, docType?: DocumentType): Promise<Array<{
    id: string;
    expiryDate?: Date;
    metadata?: any;
  }>>;
}

// Stub document storage - in production, use actual DocumentStorage service
const documentStorage: DocumentStorageService = {
  async getDocument(documentId: string) {
    // Stub: would fetch from actual document storage
    return null;
  },
  async listDocuments(vendorId: string, docType?: DocumentType) {
    // Stub: would fetch from actual document storage
    return [];
  },
};

/**
 * Check vendor compliance with required certifications and licenses
 */
export async function checkVendorCompliance(
  prisma: PrismaClient,
  vendorId: string,
  requirements: ComplianceRequirement[]
): Promise<ComplianceCheckResult> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: {
      category: true,
    },
  });

  if (!vendor) {
    throw new Error(`Vendor ${vendorId} not found`);
  }

  // Get compliance requirements from category if not provided
  const categoryRequirements =
    (vendor.category.complianceRequirements as ComplianceRequirement[]) || [];
  const allRequirements = requirements.length > 0 ? requirements : categoryRequirements;

  const requirementResults: ComplianceCheckResult['requirements'] = [];
  let overallCompliant = true;

  for (const requirement of allRequirements) {
    const result = await checkSingleRequirement(
      prisma,
      vendorId,
      requirement
    );

    requirementResults.push(result);

    if (result.status !== 'compliant') {
      overallCompliant = false;
    }
  }

  return {
    vendorId,
    compliant: overallCompliant,
    requirements: requirementResults,
    checkedAt: new Date(),
  };
}

/**
 * Check a single compliance requirement
 */
async function checkSingleRequirement(
  prisma: PrismaClient,
  vendorId: string,
  requirement: ComplianceRequirement
): Promise<ComplianceCheckResult['requirements'][0]> {
  // Find relevant documents
  const documents = await prisma.vendorDocument.findMany({
    where: {
      vendorId,
      ...(requirement.documentType && { docType: requirement.documentType }),
    },
    orderBy: { uploadedAt: 'desc' },
  });

  // Check if document exists
  if (documents.length === 0) {
    return {
      type: requirement.type,
      status: requirement.required ? 'missing' : 'pending',
      notes: requirement.required
        ? `Required ${requirement.type} document not found`
        : `Optional ${requirement.type} document not found`,
    };
  }

  // Get the latest document
  const latestDoc = documents[0];

  // Check expiry if required
  if (requirement.expiryCheck && latestDoc.metadata) {
    const metadata = latestDoc.metadata as any;
    const expiryDate = metadata.expiryDate
      ? new Date(metadata.expiryDate)
      : null;

    if (expiryDate) {
      const now = new Date();
      if (expiryDate < now) {
        return {
          type: requirement.type,
          status: 'expired',
          expiryDate,
          documentId: latestDoc.id,
          notes: `${requirement.type} expired on ${expiryDate.toISOString()}`,
        };
      }

      // Check if expiring soon (within 30 days)
      const daysUntilExpiry = Math.floor(
        (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilExpiry <= 30) {
        return {
          type: requirement.type,
          status: 'compliant',
          expiryDate,
          documentId: latestDoc.id,
          notes: `${requirement.type} expires in ${daysUntilExpiry} days`,
        };
      }
    }
  }

  // Document exists and is valid
  return {
    type: requirement.type,
    status: 'compliant',
    documentId: latestDoc.id,
    notes: `${requirement.type} is valid`,
  };
}

/**
 * Get compliance status for a vendor
 */
export async function getVendorComplianceStatus(
  prisma: PrismaClient,
  vendorId: string
): Promise<ComplianceCheckResult | null> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: {
      category: true,
    },
  });

  if (!vendor) {
    return null;
  }

  const categoryRequirements =
    (vendor.category.complianceRequirements as ComplianceRequirement[]) || [];

  return checkVendorCompliance(prisma, vendorId, categoryRequirements);
}

/**
 * Check for expired or expiring compliance documents
 */
export async function checkExpiringCompliance(
  prisma: PrismaClient,
  daysAhead: number = 30
): Promise<Array<{
  vendorId: string;
  vendorName: string;
  requirement: string;
  expiryDate: Date;
  daysUntilExpiry: number;
}>> {
  const vendors = await prisma.vendor.findMany({
    include: {
      category: true,
      documents: {
        where: {
          docType: {
            in: [DocumentType.CERTIFICATE, DocumentType.DUE_DILIGENCE],
          },
        },
        orderBy: { uploadedAt: 'desc' },
      },
    },
  });

  const expiring: Array<{
    vendorId: string;
    vendorName: string;
    requirement: string;
    expiryDate: Date;
    daysUntilExpiry: number;
  }> = [];

  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  for (const vendor of vendors) {
    const categoryRequirements =
      (vendor.category.complianceRequirements as ComplianceRequirement[]) || [];

    for (const requirement of categoryRequirements) {
      if (!requirement.expiryCheck) {
        continue;
      }

      const relevantDocs = vendor.documents.filter((doc) => {
        if (requirement.documentType && doc.docType !== requirement.documentType) {
          return false;
        }
        return true;
      });

      for (const doc of relevantDocs) {
        if (doc.metadata) {
          const metadata = doc.metadata as any;
          const expiryDate = metadata.expiryDate
            ? new Date(metadata.expiryDate)
            : null;

          if (expiryDate && expiryDate >= now && expiryDate <= futureDate) {
            const daysUntilExpiry = Math.floor(
              (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );

            expiring.push({
              vendorId: vendor.id,
              vendorName: vendor.name,
              requirement: requirement.type,
              expiryDate,
              daysUntilExpiry,
            });
          }
        }
      }
    }
  }

  return expiring;
}

/**
 * Flag non-compliant vendors
 */
export async function flagNonCompliantVendors(
  prisma: PrismaClient
): Promise<Array<{
  vendorId: string;
  vendorName: string;
  nonCompliantRequirements: string[];
}>> {
  const vendors = await prisma.vendor.findMany({
    include: {
      category: true,
    },
  });

  const nonCompliant: Array<{
    vendorId: string;
    vendorName: string;
    nonCompliantRequirements: string[];
  }> = [];

  for (const vendor of vendors) {
    const complianceResult = await getVendorComplianceStatus(prisma, vendor.id);

    if (complianceResult && !complianceResult.compliant) {
      const nonCompliantReqs = complianceResult.requirements
        .filter((r) => r.status !== 'compliant')
        .map((r) => r.type);

      if (nonCompliantReqs.length > 0) {
        nonCompliant.push({
          vendorId: vendor.id,
          vendorName: vendor.name,
          nonCompliantRequirements: nonCompliantReqs,
        });
      }
    }
  }

  return nonCompliant;
}

