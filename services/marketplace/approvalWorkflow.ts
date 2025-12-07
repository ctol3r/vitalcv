/**
 * B223A-MARKET-004: ModuleApprovalWorkflow
 *
 * Implements automated and manual checks for module approval:
 * - Security scan
 * - Capability validation
 * - Policy compliance
 * Transitions module approvalStatus from 'pending' → 'approved' or 'rejected'
 */

import { PrismaClient, ApprovalStatus } from '@prisma/client';
import { getModule, updateApprovalStatus } from './models/MarketplaceModule';
import { getVendorProfile } from './models/VendorProfile';

export interface ApprovalCheckResult {
  passed: boolean;
  checks: {
    securityScan: { passed: boolean; details?: string };
    capabilityValidation: { passed: boolean; details?: string };
    policyCompliance: { passed: boolean; details?: string };
    vendorKYC: { passed: boolean; details?: string };
  };
  overallReason?: string;
}

export interface PolicyRules {
  requiredCapabilities?: string[];
  forbiddenCapabilities?: string[];
  maxPrice?: number;
  minVendorReputation?: number;
}

export class ModuleApprovalWorkflow {
  constructor(
    private prisma: PrismaClient,
    private policyRules: PolicyRules = {}
  ) {}

  /**
   * Run automated security scan
   */
  private async runSecurityScan(moduleId: string): Promise<{ passed: boolean; details?: string }> {
    const module = await getModule(this.prisma, moduleId);
    if (!module) {
      return { passed: false, details: 'Module not found' };
    }

    // Automated checks:
    // 1. Check for suspicious capability names
    const suspiciousPatterns = ['admin', 'root', 'delete', 'drop', 'exec'];
    const hasSuspiciousCapability = module.capabilities.some((cap) =>
      suspiciousPatterns.some((pattern) => cap.toLowerCase().includes(pattern))
    );

    if (hasSuspiciousCapability) {
      return {
        passed: false,
        details: 'Module contains suspicious capabilities that may pose security risks',
      };
    }

    // 2. Check module name/description for malicious content
    const maliciousKeywords = ['malware', 'virus', 'exploit', 'hack'];
    const hasMaliciousContent =
      maliciousKeywords.some((keyword) => module.name.toLowerCase().includes(keyword)) ||
      maliciousKeywords.some((keyword) => module.description.toLowerCase().includes(keyword));

    if (hasMaliciousContent) {
      return {
        passed: false,
        details: 'Module contains potentially malicious content in name or description',
      };
    }

    // 3. Basic validation: module must have at least one capability
    if (module.capabilities.length === 0) {
      return {
        passed: false,
        details: 'Module must have at least one capability',
      };
    }

    return { passed: true, details: 'Security scan passed' };
  }

  /**
   * Validate module capabilities
   */
  private async validateCapabilities(moduleId: string): Promise<{ passed: boolean; details?: string }> {
    const module = await getModule(this.prisma, moduleId);
    if (!module) {
      return { passed: false, details: 'Module not found' };
    }

    // Check required capabilities
    if (this.policyRules.requiredCapabilities && this.policyRules.requiredCapabilities.length > 0) {
      const missingCapabilities = this.policyRules.requiredCapabilities.filter(
        (required) => !module.capabilities.includes(required)
      );
      if (missingCapabilities.length > 0) {
        return {
          passed: false,
          details: `Missing required capabilities: ${missingCapabilities.join(', ')}`,
        };
      }
    }

    // Check forbidden capabilities
    if (this.policyRules.forbiddenCapabilities && this.policyRules.forbiddenCapabilities.length > 0) {
      const forbiddenFound = module.capabilities.filter((cap) =>
        this.policyRules.forbiddenCapabilities!.includes(cap)
      );
      if (forbiddenFound.length > 0) {
        return {
          passed: false,
          details: `Contains forbidden capabilities: ${forbiddenFound.join(', ')}`,
        };
      }
    }

    // Validate capability format (basic: non-empty strings)
    const invalidCapabilities = module.capabilities.filter((cap) => !cap || cap.trim().length === 0);
    if (invalidCapabilities.length > 0) {
      return {
        passed: false,
        details: 'Module contains invalid (empty) capabilities',
      };
    }

    return { passed: true, details: 'Capability validation passed' };
  }

  /**
   * Check policy compliance
   */
  private async checkPolicyCompliance(moduleId: string): Promise<{ passed: boolean; details?: string }> {
    const module = await getModule(this.prisma, moduleId);
    if (!module) {
      return { passed: false, details: 'Module not found' };
    }

    // Check price limits
    if (this.policyRules.maxPrice !== undefined && module.price > this.policyRules.maxPrice) {
      return {
        passed: false,
        details: `Module price (${module.price}) exceeds maximum allowed price (${this.policyRules.maxPrice})`,
      };
    }

    // Check vendor reputation
    const vendor = await getVendorProfile(this.prisma, module.vendorId);
    if (!vendor) {
      return { passed: false, details: 'Vendor not found' };
    }

    if (
      this.policyRules.minVendorReputation !== undefined &&
      vendor.reputationScore < this.policyRules.minVendorReputation
    ) {
      return {
        passed: false,
        details: `Vendor reputation score (${vendor.reputationScore}) is below minimum required (${this.policyRules.minVendorReputation})`,
      };
    }

    // Check vendor KYC status
    if (vendor.kycStatus !== 'VERIFIED') {
      return {
        passed: false,
        details: `Vendor KYC status must be VERIFIED. Current status: ${vendor.kycStatus}`,
      };
    }

    return { passed: true, details: 'Policy compliance check passed' };
  }

  /**
   * Run all automated checks
   */
  async runAutomatedChecks(moduleId: string): Promise<ApprovalCheckResult> {
    const securityScan = await this.runSecurityScan(moduleId);
    const capabilityValidation = await this.validateCapabilities(moduleId);
    const policyCompliance = await this.checkPolicyCompliance(moduleId);

    // Vendor KYC check (part of policy compliance, but extracted for clarity)
    const module = await getModule(this.prisma, moduleId);
    let vendorKYC = { passed: false, details: 'Module not found' };
    if (module) {
      const vendor = await getVendorProfile(this.prisma, module.vendorId);
      if (vendor) {
        vendorKYC = {
          passed: vendor.kycStatus === 'VERIFIED',
          details: vendor.kycStatus === 'VERIFIED' ? 'Vendor KYC verified' : `Vendor KYC status: ${vendor.kycStatus}`,
        };
      }
    }

    const allPassed = securityScan.passed && capabilityValidation.passed && policyCompliance.passed && vendorKYC.passed;

    const result: ApprovalCheckResult = {
      passed: allPassed,
      checks: {
        securityScan,
        capabilityValidation,
        policyCompliance,
        vendorKYC,
      },
    };

    if (!allPassed) {
      const failures = [];
      if (!securityScan.passed) failures.push(`Security scan: ${securityScan.details}`);
      if (!capabilityValidation.passed) failures.push(`Capability validation: ${capabilityValidation.details}`);
      if (!policyCompliance.passed) failures.push(`Policy compliance: ${policyCompliance.details}`);
      if (!vendorKYC.passed) failures.push(`Vendor KYC: ${vendorKYC.details}`);
      result.overallReason = failures.join('; ');
    }

    return result;
  }

  /**
   * Process module approval (automated + manual review)
   */
  async processApproval(
    moduleId: string,
    manualReviewResult?: { approved: boolean; reviewerNotes?: string }
  ): Promise<{ status: ApprovalStatus; reason?: string }> {
    const module = await getModule(this.prisma, moduleId);
    if (!module) {
      throw new Error(`Module ${moduleId} not found`);
    }

    if (module.approvalStatus !== ApprovalStatus.PENDING && module.approvalStatus !== ApprovalStatus.UNDER_REVIEW) {
      throw new Error(`Module is not in PENDING or UNDER_REVIEW status. Current status: ${module.approvalStatus}`);
    }

    // Run automated checks
    const automatedResult = await this.runAutomatedChecks(moduleId);

    // If automated checks fail, reject immediately
    if (!automatedResult.passed) {
      await updateApprovalStatus(this.prisma, moduleId, ApprovalStatus.REJECTED);
      return {
        status: ApprovalStatus.REJECTED,
        reason: automatedResult.overallReason || 'Automated checks failed',
      };
    }

    // If manual review provided, use that result
    if (manualReviewResult !== undefined) {
      const newStatus = manualReviewResult.approved ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;
      await updateApprovalStatus(this.prisma, moduleId, newStatus);
      return {
        status: newStatus,
        reason: manualReviewResult.reviewerNotes,
      };
    }

    // If automated checks pass but no manual review, move to UNDER_REVIEW
    if (module.approvalStatus === ApprovalStatus.PENDING) {
      await updateApprovalStatus(this.prisma, moduleId, ApprovalStatus.UNDER_REVIEW);
      return {
        status: ApprovalStatus.UNDER_REVIEW,
        reason: 'Automated checks passed, awaiting manual review',
      };
    }

    // Already under review, return current status
    return {
      status: ApprovalStatus.UNDER_REVIEW,
      reason: 'Module is under manual review',
    };
  }

  /**
   * Manually approve a module
   */
  async approveModule(moduleId: string, reviewerNotes?: string): Promise<void> {
    await this.processApproval(moduleId, { approved: true, reviewerNotes });
  }

  /**
   * Manually reject a module
   */
  async rejectModule(moduleId: string, reviewerNotes?: string): Promise<void> {
    await this.processApproval(moduleId, { approved: false, reviewerNotes });
  }
}

