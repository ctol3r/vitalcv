/**
 * B227A-DEV-002: ModuleUploadHandler
 *
 * Handles multipart uploads of module packages, verifies signatures,
 * stores in temporary staging area, and triggers ModuleScanner and ApprovalWorkflow.
 */

import { PrismaClient } from '@prisma/client';
import { Request } from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { ModuleScanner } from './moduleScanner';
import { ModuleApprovalWorkflow } from '../marketplace/approvalWorkflow';
import { createModule, MarketplaceModuleInput } from '../marketplace/models/MarketplaceModule';
import { LicenseType, ApprovalStatus } from '@prisma/client';

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface ModulePackageMetadata {
  name: string;
  version: string;
  description: string;
  capabilities: string[];
  vendorId: string;
  signature?: string;
  signatureAlgorithm?: string;
}

export interface UploadResult {
  stagingId: string;
  moduleId?: string;
  status: 'staged' | 'scanned' | 'approved' | 'rejected';
  scanResults?: any;
  approvalResults?: any;
  error?: string;
}

export class ModuleUploadHandler {
  private stagingDir: string;
  private maxFileSize: number = 50 * 1024 * 1024; // 50MB

  constructor(
    private prisma: PrismaClient,
    stagingDir: string = '/tmp/module-staging'
  ) {
    this.stagingDir = stagingDir;
  }

  /**
   * Initialize staging directory
   */
  private async ensureStagingDir(): Promise<void> {
    try {
      await fs.mkdir(this.stagingDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore
    }
  }

  /**
   * Generate staging ID
   */
  private generateStagingId(): string {
    return `staging_${crypto.randomBytes(16).toString('hex')}`;
  }

  /**
   * Verify module package signature
   */
  private async verifySignature(
    packageBuffer: Buffer,
    signature: string,
    algorithm: string = 'sha256'
  ): Promise<boolean> {
    try {
      const hash = crypto.createHash(algorithm).update(packageBuffer).digest('hex');
      return hash === signature.toLowerCase();
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract metadata from package (simplified - in production, parse package.json or manifest)
   */
  private async extractMetadata(
    packageBuffer: Buffer,
    metadata: Partial<ModulePackageMetadata>
  ): Promise<ModulePackageMetadata> {
    // In production, this would parse the actual package file (zip, tar, etc.)
    // For now, we'll use the provided metadata and validate it
    if (!metadata.name || !metadata.version || !metadata.vendorId) {
      throw new Error('Missing required metadata: name, version, or vendorId');
    }

    return {
      name: metadata.name,
      version: metadata.version,
      description: metadata.description || '',
      capabilities: metadata.capabilities || [],
      vendorId: metadata.vendorId,
      signature: metadata.signature,
      signatureAlgorithm: metadata.signatureAlgorithm || 'sha256',
    };
  }

  /**
   * Store package in staging area
   */
  private async storeInStaging(
    stagingId: string,
    packageBuffer: Buffer,
    metadata: ModulePackageMetadata
  ): Promise<string> {
    await this.ensureStagingDir();

    const stagingPath = path.join(this.stagingDir, `${stagingId}.pkg`);
    await fs.writeFile(stagingPath, packageBuffer);

    // Store metadata alongside
    const metadataPath = path.join(this.stagingDir, `${stagingId}.metadata.json`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    return stagingPath;
  }

  /**
   * Handle multipart upload
   */
  async handleUpload(
    req: Request,
    metadata: Partial<ModulePackageMetadata>
  ): Promise<UploadResult> {
    try {
      // Extract file from request (assuming multer middleware)
      const file = (req as any).file as UploadedFile | undefined;
      if (!file) {
        throw new Error('No file uploaded');
      }

      // Validate file size
      if (file.size > this.maxFileSize) {
        throw new Error(`File size exceeds maximum allowed size of ${this.maxFileSize} bytes`);
      }

      // Validate file type (should be zip, tar, or similar)
      const allowedTypes = [
        'application/zip',
        'application/x-tar',
        'application/gzip',
        'application/x-gzip',
      ];
      if (!allowedTypes.includes(file.mimetype)) {
        throw new Error(`Invalid file type: ${file.mimetype}`);
      }

      // Extract metadata
      const packageMetadata = await this.extractMetadata(file.buffer, metadata);

      // Verify signature if provided
      if (packageMetadata.signature) {
        const isValid = await this.verifySignature(
          file.buffer,
          packageMetadata.signature,
          packageMetadata.signatureAlgorithm
        );
        if (!isValid) {
          throw new Error('Package signature verification failed');
        }
      }

      // Store in staging
      const stagingId = this.generateStagingId();
      await this.storeInStaging(stagingId, file.buffer, packageMetadata);

      // Trigger ModuleScanner
      const scanner = new ModuleScanner(this.prisma);
      const scanResults = await scanner.scanModule(stagingId, packageMetadata);

      if (!scanResults.success) {
        return {
          stagingId,
          status: 'rejected',
          scanResults,
          error: scanResults.error,
        };
      }

      // Create module record
      const moduleInput: MarketplaceModuleInput = {
        name: packageMetadata.name,
        version: packageMetadata.version,
        description: packageMetadata.description,
        vendorId: packageMetadata.vendorId,
        capabilities: packageMetadata.capabilities,
        price: 0, // Default price, can be updated later
        currency: 'USD',
        licenseType: LicenseType.SUBSCRIPTION, // Default, can be updated
        approvalStatus: ApprovalStatus.PENDING,
      };

      const module = await createModule(this.prisma, moduleInput);

      // Trigger ApprovalWorkflow
      const workflow = new ModuleApprovalWorkflow(this.prisma);
      const approvalResults = await workflow.runAutomatedChecks(module.id);

      if (approvalResults.passed) {
        await workflow.processApproval(module.id);
      } else {
        await workflow.processApproval(module.id, {
          approved: false,
          reviewerNotes: approvalResults.overallReason,
        });
      }

      const finalModule = await this.prisma.marketplaceModule.findUnique({
        where: { id: module.id },
      });

      return {
        stagingId,
        moduleId: module.id,
        status: finalModule?.approvalStatus === ApprovalStatus.APPROVED ? 'approved' : 'scanned',
        scanResults,
        approvalResults,
      };
    } catch (error: any) {
      return {
        stagingId: this.generateStagingId(),
        status: 'rejected',
        error: error.message || 'Upload failed',
      };
    }
  }

  /**
   * Clean up staging files older than specified age
   */
  async cleanupStaging(maxAgeHours: number = 24): Promise<number> {
    await this.ensureStagingDir();

    const files = await fs.readdir(this.stagingDir);
    const now = Date.now();
    let cleaned = 0;

    for (const file of files) {
      const filePath = path.join(this.stagingDir, file);
      const stats = await fs.stat(filePath);
      const ageHours = (now - stats.mtimeMs) / (1000 * 60 * 60);

      if (ageHours > maxAgeHours) {
        await fs.unlink(filePath);
        cleaned++;
      }
    }

    return cleaned;
  }
}

