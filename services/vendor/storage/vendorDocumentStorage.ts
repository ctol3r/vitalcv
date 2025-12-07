/**
 * B240A-VM-009: VendorDocumentStorage
 *
 * Securely stores vendor documents (due diligence forms, certificates, policies)
 * encrypted; indexes by vendorId and docType; supports upload, versioning, retrieval;
 * integrates with EvidenceStore
 */

import { PrismaClient, DocumentType } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import crypto from 'node:crypto';
import {
  uploadEvidence,
  getEvidenceDocument,
  listEvidenceDocuments,
  UploadEvidenceOptions,
} from '../../compliance/evidence/evidenceStore.js';

const log = getServiceLogger('vendor/storage/document');

export interface VendorDocumentInput {
  vendorId: string;
  docType: DocumentType;
  title: string;
  description?: string;
  fileName: string;
  mimeType: string;
  fileData: Buffer;
  uploadedBy: string;
  metadata?: Record<string, any>;
}

export interface VendorDocument {
  id: string;
  vendorId: string;
  docType: DocumentType;
  title: string;
  description: string | null;
  fileName: string;
  mimeType: string;
  fileSize: number;
  version: number;
  encrypted: boolean;
  storagePath: string;
  checksum: string;
  uploadedBy: string;
  uploadedAt: Date;
  metadata: Record<string, any> | null;
}

/**
 * Encrypt file data
 */
async function encryptFileData(fileData: Buffer): Promise<Buffer> {
  // In production, use proper encryption (AES-256-GCM)
  // For now, we'll use a simple encryption key from env
  const encryptionKey = process.env.VENDOR_DOC_ENCRYPTION_KEY || 'default-key-change-in-production';
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(encryptionKey, 'salt', 32);
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(fileData),
    cipher.final(),
  ]);

  // Prepend IV to encrypted data
  return Buffer.concat([iv, encrypted]);
}

/**
 * Decrypt file data
 */
async function decryptFileData(encryptedData: Buffer): Promise<Buffer> {
  const encryptionKey = process.env.VENDOR_DOC_ENCRYPTION_KEY || 'default-key-change-in-production';
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(encryptionKey, 'salt', 32);

  // Extract IV (first 16 bytes)
  const iv = encryptedData.slice(0, 16);
  const encrypted = encryptedData.slice(16);

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
}

/**
 * Generate storage path for vendor document
 */
function generateStoragePath(
  vendorId: string,
  docType: DocumentType,
  fileName: string
): string {
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `vendors/${vendorId}/${docType}/${timestamp}_${sanitizedFileName}`;
}

/**
 * Store file data (in production, use S3, Azure Blob, etc.)
 */
async function storeFileData(storagePath: string, encryptedData: Buffer): Promise<void> {
  // TODO: Implement actual file storage (S3, Azure Blob, etc.)
  // For now, this is a placeholder
  log.info('[storeFileData] Storing file', { storagePath, size: encryptedData.length });
}

/**
 * Retrieve file data
 */
async function retrieveFileData(storagePath: string): Promise<Buffer> {
  // TODO: Implement actual file retrieval
  // For now, this is a placeholder
  log.info('[retrieveFileData] Retrieving file', { storagePath });
  return Buffer.from([]);
}

/**
 * Upload vendor document
 */
export async function uploadVendorDocument(
  prisma: PrismaClient,
  input: VendorDocumentInput
): Promise<VendorDocument> {
  const {
    vendorId,
    docType,
    title,
    description,
    fileName,
    mimeType,
    fileData,
    uploadedBy,
    metadata,
  } = input;

  // Verify vendor exists
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
  });
  if (!vendor) {
    throw new Error(`Vendor with id ${vendorId} not found`);
  }

  // Calculate checksum
  const checksum = crypto.createHash('sha256').update(fileData).digest('hex');

  // Check if document already exists (same vendor, type, and checksum)
  const existing = await prisma.vendorDocument.findFirst({
    where: {
      vendorId,
      docType,
      checksum,
    },
  });

  if (existing) {
    log.info('[uploadVendorDocument] Document already exists', {
      existingId: existing.id,
      checksum,
    });
    // Return existing or create new version
    const version = existing.version + 1;
    const storagePath = generateStoragePath(vendorId, docType, fileName);

    // Encrypt and store
    const encryptedData = await encryptFileData(fileData);
    await storeFileData(storagePath, encryptedData);

    // Create new version
    const newDoc = await prisma.vendorDocument.create({
      data: {
        vendorId,
        docType,
        title,
        description: description ?? null,
        fileName,
        mimeType,
        fileSize: fileData.length,
        version,
        encrypted: true,
        storagePath,
        checksum,
        uploadedBy,
        metadata: metadata || {},
      },
    });

    return newDoc;
  }

  // Encrypt file data
  const encryptedData = await encryptFileData(fileData);
  const storagePath = generateStoragePath(vendorId, docType, fileName);

  // Store file
  await storeFileData(storagePath, encryptedData);

  // Get version number
  const existingDocs = await prisma.vendorDocument.findMany({
    where: {
      vendorId,
      docType,
    },
    orderBy: { version: 'desc' },
    take: 1,
  });
  const version = existingDocs.length > 0 ? existingDocs[0].version + 1 : 1;

  // Create database record
  const document = await prisma.vendorDocument.create({
    data: {
      vendorId,
      docType,
      title,
      description: description ?? null,
      fileName,
      mimeType,
      fileSize: fileData.length,
      version,
      encrypted: true,
      storagePath,
      checksum,
      uploadedBy,
      metadata: metadata || {},
    },
  });

  // Also store in EvidenceStore for compliance tracking
  try {
    await uploadEvidence({
      orgId: vendor.orgId,
      obligationId: `vendor-${vendorId}`,
      documentType: docType === DocumentType.CERTIFICATE ? 'certificate' :
                   docType === DocumentType.POLICY ? 'policy' : 'other',
      title,
      description,
      fileName,
      mimeType,
      fileData,
      uploadedBy,
      metadata: {
        ...metadata,
        vendorId,
        docType,
      },
    });
  } catch (error) {
    log.warn('[uploadVendorDocument] Failed to store in EvidenceStore', {
      error,
      vendorId,
    });
    // Don't fail the upload if EvidenceStore fails
  }

  log.info('[uploadVendorDocument] Document uploaded', {
    documentId: document.id,
    vendorId,
    docType,
    version,
  });

  return document;
}

/**
 * Get vendor document by ID
 */
export async function getVendorDocument(
  prisma: PrismaClient,
  id: string
): Promise<VendorDocument | null> {
  return prisma.vendorDocument.findUnique({
    where: { id },
  });
}

/**
 * List vendor documents with optional filters
 */
export async function listVendorDocuments(
  prisma: PrismaClient,
  vendorId: string,
  filters?: {
    docType?: DocumentType;
    version?: number;
  }
): Promise<VendorDocument[]> {
  return prisma.vendorDocument.findMany({
    where: {
      vendorId,
      ...(filters?.docType && { docType: filters.docType }),
      ...(filters?.version && { version: filters.version }),
    },
    orderBy: [
      { docType: 'asc' },
      { version: 'desc' },
    ],
  });
}

/**
 * Retrieve document file data (decrypted)
 */
export async function retrieveVendorDocumentFile(
  prisma: PrismaClient,
  documentId: string
): Promise<{ fileData: Buffer; mimeType: string; fileName: string }> {
  const document = await prisma.vendorDocument.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new Error(`Document with id ${documentId} not found`);
  }

  // Retrieve encrypted file
  const encryptedData = await retrieveFileData(document.storagePath);

  // Decrypt file
  const fileData = document.encrypted
    ? await decryptFileData(encryptedData)
    : encryptedData;

  return {
    fileData,
    mimeType: document.mimeType,
    fileName: document.fileName,
  };
}

/**
 * Get document versions for a specific document (by vendorId, docType, and title)
 */
export async function getDocumentVersions(
  prisma: PrismaClient,
  vendorId: string,
  docType: DocumentType,
  title: string
): Promise<VendorDocument[]> {
  return prisma.vendorDocument.findMany({
    where: {
      vendorId,
      docType,
      title,
    },
    orderBy: { version: 'desc' },
  });
}

/**
 * Delete vendor document (soft delete by marking as deleted in metadata)
 */
export async function deleteVendorDocument(
  prisma: PrismaClient,
  id: string,
  deletedBy: string
): Promise<void> {
  const document = await prisma.vendorDocument.findUnique({
    where: { id },
  });

  if (!document) {
    throw new Error(`Document with id ${id} not found`);
  }

  // Update metadata to mark as deleted
  const metadata = (document.metadata as Record<string, any>) || {};
  metadata.deleted = true;
  metadata.deletedAt = new Date().toISOString();
  metadata.deletedBy = deletedBy;

  await prisma.vendorDocument.update({
    where: { id },
    data: {
      metadata,
    },
  });

  log.info('[deleteVendorDocument] Document marked as deleted', {
    documentId: id,
    vendorId: document.vendorId,
    deletedBy,
  });
}

