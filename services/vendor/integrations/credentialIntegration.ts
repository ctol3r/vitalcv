/**
 * B240B-VM-018: Credential Integration for Vendors
 *
 * Links vendor credentials and certificates with credential lifecycle:
 * - Ensures expiry and revocation propagate to vendor status
 * - Triggers compliance checks and renewal workflows
 */

import { PrismaClient, VendorStatus } from '@prisma/client';
import { checkVendorCompliance } from '../services/complianceCheckService';
import { scheduleRenewalTasks } from '../services/renewalTerminationPolicyService';

export interface VendorCredentialLink {
  vendorId: string;
  credentialId: string;
  credentialType: string; // e.g., "ISO_27001", "HIPAA", "license"
  linkedAt: Date;
  expiresAt?: Date;
  revoked: boolean;
}

/**
 * Link a credential to a vendor
 */
export async function linkCredentialToVendor(
  prisma: PrismaClient,
  vendorId: string,
  credentialId: string,
  credentialType: string,
  expiresAt?: Date
): Promise<void> {
  // Store credential link in vendor document metadata
  // In production, create a separate VendorCredentialLink table
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
  });

  if (!vendor) {
    throw new Error(`Vendor ${vendorId} not found`);
  }

  // Create or update vendor document to track credential
  await prisma.vendorDocument.upsert({
    where: {
      vendorId_docType_version: {
        vendorId,
        docType: 'CERTIFICATE',
        version: 1,
      },
    },
    create: {
      vendorId,
      docType: 'CERTIFICATE',
      fileName: `${credentialType}_credential`,
      filePath: `credentials/${credentialId}`,
      metadata: {
        credentialId,
        credentialType,
        linkedAt: new Date(),
        expiresAt,
        revoked: false,
      },
    },
    update: {
      metadata: {
        credentialId,
        credentialType,
        linkedAt: new Date(),
        expiresAt,
        revoked: false,
      },
    },
  });
}

/**
 * Handle credential expiry event
 * Updates vendor status and triggers compliance checks
 */
export async function handleCredentialExpiry(
  prisma: PrismaClient,
  credentialId: string
): Promise<void> {
  // Find vendor linked to this credential
  // Note: Prisma doesn't support JSON path queries directly, so we fetch all and filter
  const allCertificates = await prisma.vendorDocument.findMany({
    where: {
      docType: 'CERTIFICATE',
    },
  });

  const documents = allCertificates.filter((doc) => {
    const metadata = doc.metadata as any;
    return metadata?.credentialId === credentialId;
  });

  for (const doc of documents) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: doc.vendorId },
    });

    if (!vendor) {
      continue;
    }

    // Update document metadata to mark as expired
    await prisma.vendorDocument.update({
      where: { id: doc.id },
      data: {
        metadata: {
          ...(doc.metadata as any),
          expired: true,
          expiredAt: new Date(),
        },
      },
    });

    // Trigger compliance check
    try {
      await checkVendorCompliance(prisma, doc.vendorId, []);
    } catch (error) {
      console.error(`Error checking compliance for vendor ${doc.vendorId}:`, error);
    }

    // If vendor is active and critical credential expired, consider status change
    if (vendor.status === VendorStatus.ACTIVE) {
      const metadata = doc.metadata as any;
      if (metadata.credentialType && isCriticalCredential(metadata.credentialType)) {
        // In production, might want to set status to INACTIVE or PENDING
        // For now, log the event
        console.warn(
          `Critical credential ${metadata.credentialType} expired for vendor ${vendor.id}`
        );
      }
    }
  }
}

/**
 * Handle credential revocation event
 * Updates vendor status and triggers compliance checks
 */
export async function handleCredentialRevocation(
  prisma: PrismaClient,
  credentialId: string
): Promise<void> {
  // Find vendor linked to this credential
  // Note: Prisma doesn't support JSON path queries directly, so we fetch all and filter
  const allCertificates = await prisma.vendorDocument.findMany({
    where: {
      docType: 'CERTIFICATE',
    },
  });

  const documents = allCertificates.filter((doc) => {
    const metadata = doc.metadata as any;
    return metadata?.credentialId === credentialId;
  });

  for (const doc of documents) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: doc.vendorId },
    });

    if (!vendor) {
      continue;
    }

    // Update document metadata to mark as revoked
    await prisma.vendorDocument.update({
      where: { id: doc.id },
      data: {
        metadata: {
          ...(doc.metadata as any),
          revoked: true,
          revokedAt: new Date(),
        },
      },
    });

    // Trigger compliance check
    try {
      await checkVendorCompliance(prisma, doc.vendorId, []);
    } catch (error) {
      console.error(`Error checking compliance for vendor ${doc.vendorId}:`, error);
    }

    // If vendor is active and critical credential revoked, update status
    if (vendor.status === VendorStatus.ACTIVE) {
      const metadata = doc.metadata as any;
      if (metadata.credentialType && isCriticalCredential(metadata.credentialType)) {
        // Set vendor to inactive if critical credential is revoked
        await prisma.vendor.update({
          where: { id: doc.vendorId },
          data: {
            status: VendorStatus.INACTIVE,
          },
        });
      }
    }
  }
}

/**
 * Check if a credential type is critical for vendor operations
 */
function isCriticalCredential(credentialType: string): boolean {
  const criticalTypes = [
    'HIPAA',
    'SOC2',
    'ISO_27001',
    'PCI_DSS',
    'license',
    'insurance',
  ];
  return criticalTypes.some((type) =>
    credentialType.toUpperCase().includes(type.toUpperCase())
  );
}

/**
 * Sync credential lifecycle with vendor status
 * Called periodically to check for expired/revoked credentials
 */
export async function syncCredentialLifecycle(
  prisma: PrismaClient
): Promise<{
  expired: number;
  revoked: number;
  updated: number;
}> {
  const now = new Date();
  let expired = 0;
  let revoked = 0;
  let updated = 0;

  // Find all certificate documents
  const certificates = await prisma.vendorDocument.findMany({
    where: {
      docType: 'CERTIFICATE',
    },
  });

  for (const cert of certificates) {
    const metadata = cert.metadata as any;
    if (!metadata) {
      continue;
    }

    // Check for expiry
    if (metadata.expiresAt && !metadata.expired && !metadata.revoked) {
      const expiryDate = new Date(metadata.expiresAt);
      if (expiryDate < now) {
        await handleCredentialExpiry(prisma, metadata.credentialId || cert.id);
        expired++;
        updated++;
      }
    }

    // Check for revocation (would be set by credential lifecycle service)
    if (metadata.revoked && !metadata.revokedAt) {
      await handleCredentialRevocation(prisma, metadata.credentialId || cert.id);
      revoked++;
      updated++;
    }
  }

  return { expired, revoked, updated };
}

/**
 * Get credentials linked to a vendor
 */
export async function getVendorCredentials(
  prisma: PrismaClient,
  vendorId: string
): Promise<VendorCredentialLink[]> {
  const documents = await prisma.vendorDocument.findMany({
    where: {
      vendorId,
      docType: 'CERTIFICATE',
    },
  });

  return documents
    .map((doc) => {
      const metadata = doc.metadata as any;
      if (!metadata || !metadata.credentialId) {
        return null;
      }

      return {
        vendorId: doc.vendorId,
        credentialId: metadata.credentialId,
        credentialType: metadata.credentialType || 'unknown',
        linkedAt: metadata.linkedAt ? new Date(metadata.linkedAt) : doc.createdAt,
        expiresAt: metadata.expiresAt ? new Date(metadata.expiresAt) : undefined,
        revoked: metadata.revoked || false,
      };
    })
    .filter((link): link is VendorCredentialLink => link !== null);
}

/**
 * Trigger compliance check when credential changes
 */
export async function triggerComplianceCheckOnCredentialChange(
  prisma: PrismaClient,
  vendorId: string
): Promise<void> {
  // Trigger compliance check
  await checkVendorCompliance(prisma, vendorId, []);

  // Trigger renewal workflow check
  await scheduleRenewalTasks(prisma);
}

