/**
 * B227A-DEV-002: ModuleScanner
 *
 * Scans uploaded module packages for security issues, validates structure,
 * and extracts metadata. Used by ModuleUploadHandler.
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export interface ModulePackageMetadata {
  name: string;
  version: string;
  description: string;
  capabilities: string[];
  vendorId: string;
  signature?: string;
  signatureAlgorithm?: string;
}

export interface ScanResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  metadata?: ModulePackageMetadata;
  securityIssues?: string[];
  structureValid?: boolean;
  error?: string;
}

export class ModuleScanner {
  constructor(private prisma: PrismaClient) {}

  /**
   * Scan a module package
   */
  async scanModule(
    stagingId: string,
    metadata: ModulePackageMetadata
  ): Promise<ScanResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const securityIssues: string[] = [];

    try {
      // Validate metadata
      if (!metadata.name || metadata.name.trim().length === 0) {
        errors.push('Module name is required');
      }

      if (!metadata.version || metadata.version.trim().length === 0) {
        errors.push('Module version is required');
      }

      if (!metadata.vendorId || metadata.vendorId.trim().length === 0) {
        errors.push('Vendor ID is required');
      }

      // Validate version format (semantic versioning)
      if (metadata.version && !this.isValidSemanticVersion(metadata.version)) {
        warnings.push(`Version "${metadata.version}" does not follow semantic versioning`);
      }

      // Check for suspicious capability names
      const suspiciousPatterns = ['admin', 'root', 'delete', 'drop', 'exec', 'eval'];
      metadata.capabilities?.forEach((cap) => {
        if (suspiciousPatterns.some((pattern) => cap.toLowerCase().includes(pattern))) {
          securityIssues.push(`Suspicious capability detected: ${cap}`);
        }
      });

      // Check for malicious keywords in name/description
      const maliciousKeywords = ['malware', 'virus', 'exploit', 'hack', 'backdoor'];
      const nameLower = metadata.name.toLowerCase();
      const descLower = metadata.description?.toLowerCase() || '';

      maliciousKeywords.forEach((keyword) => {
        if (nameLower.includes(keyword) || descLower.includes(keyword)) {
          securityIssues.push(`Potentially malicious content detected: ${keyword}`);
        }
      });

      // Validate capabilities array
      if (!Array.isArray(metadata.capabilities)) {
        errors.push('Capabilities must be an array');
      } else if (metadata.capabilities.length === 0) {
        warnings.push('Module has no capabilities defined');
      }

      // Check if vendor exists
      const vendor = await this.prisma.vendorProfile.findUnique({
        where: { vendorId: metadata.vendorId },
      });

      if (!vendor) {
        errors.push(`Vendor with ID ${metadata.vendorId} not found`);
      }

      // Validate package structure (simplified - in production, would extract and inspect)
      const structureValid = await this.validatePackageStructure(stagingId);

      if (errors.length > 0) {
        return {
          success: false,
          errors,
          warnings,
          securityIssues: securityIssues.length > 0 ? securityIssues : undefined,
          structureValid,
          error: errors.join('; '),
        };
      }

      return {
        success: true,
        errors: [],
        warnings,
        metadata,
        securityIssues: securityIssues.length > 0 ? securityIssues : undefined,
        structureValid,
      };
    } catch (error: any) {
      return {
        success: false,
        errors: [error.message || 'Scan failed'],
        warnings: [],
        error: error.message || 'Scan failed',
      };
    }
  }

  /**
   * Validate semantic version format
   */
  private isValidSemanticVersion(version: string): boolean {
    // Basic semantic version regex: MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
    const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
    return semverRegex.test(version);
  }

  /**
   * Validate package structure (simplified - in production would extract and inspect)
   */
  private async validatePackageStructure(stagingId: string): Promise<boolean> {
    try {
      // In production, this would:
      // 1. Extract the package file
      // 2. Check for required files (package.json, README.md, etc.)
      // 3. Validate file structure
      // 4. Check for required directories

      // For now, just check if the staging file exists
      const stagingDir = process.env.MODULE_STAGING_DIR || '/tmp/module-staging';
      const packagePath = path.join(stagingDir, `${stagingId}.pkg`);

      try {
        await fs.access(packagePath);
        return true;
      } catch {
        return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Calculate package hash
   */
  async calculatePackageHash(stagingId: string, algorithm: string = 'sha256'): Promise<string> {
    try {
      const stagingDir = process.env.MODULE_STAGING_DIR || '/tmp/module-staging';
      const packagePath = path.join(stagingDir, `${stagingId}.pkg`);

      const buffer = await fs.readFile(packagePath);
      return crypto.createHash(algorithm).update(buffer).digest('hex');
    } catch (error) {
      throw new Error(`Failed to calculate package hash: ${error}`);
    }
  }
}

