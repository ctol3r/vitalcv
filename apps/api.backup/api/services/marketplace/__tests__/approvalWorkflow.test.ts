/**
 * B223A-MARKET-004: ModuleApprovalWorkflow Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PrismaClient, ApprovalStatus, LicenseType, KYCStatus } from '@prisma/client';
import { ModuleApprovalWorkflow } from '../approvalWorkflow';
import * as MarketplaceModule from '../models/MarketplaceModule';
import * as VendorProfile from '../models/VendorProfile';

// Mock Prisma client
const mockPrisma = {} as unknown as PrismaClient;

describe('ModuleApprovalWorkflow', () => {
  let workflow: ModuleApprovalWorkflow;

  beforeEach(() => {
    jest.clearAllMocks();
    workflow = new ModuleApprovalWorkflow(mockPrisma);
  });

  describe('runAutomatedChecks', () => {
    it('should pass all checks for valid module', async () => {
      const moduleId = 'module-1';
      const mockModule = {
        id: moduleId,
        name: 'Valid Module',
        description: 'A valid module description',
        vendorId: 'vendor-1',
        capabilities: ['valid-capability'],
        price: 99.99,
        licenseType: LicenseType.SUBSCRIPTION,
      };

      const mockVendor = {
        id: 'profile-1',
        vendorId: 'vendor-1',
        kycStatus: KYCStatus.VERIFIED,
        reputationScore: 85,
      };

      jest.spyOn(MarketplaceModule, 'getModule').mockResolvedValue(mockModule as any);
      jest.spyOn(VendorProfile, 'getVendorProfile').mockResolvedValue(mockVendor as any);

      const result = await workflow.runAutomatedChecks(moduleId);

      expect(result.passed).toBe(true);
      expect(result.checks.securityScan.passed).toBe(true);
      expect(result.checks.capabilityValidation.passed).toBe(true);
      expect(result.checks.policyCompliance.passed).toBe(true);
      expect(result.checks.vendorKYC.passed).toBe(true);
    });

    it('should fail security scan for suspicious capabilities', async () => {
      const moduleId = 'module-1';
      const mockModule = {
        id: moduleId,
        name: 'Suspicious Module',
        description: 'A suspicious module',
        vendorId: 'vendor-1',
        capabilities: ['admin-access', 'delete-all'],
        price: 99.99,
        licenseType: LicenseType.SUBSCRIPTION,
      };

      jest.spyOn(MarketplaceModule, 'getModule').mockResolvedValue(mockModule as any);

      const result = await workflow.runAutomatedChecks(moduleId);

      expect(result.passed).toBe(false);
      expect(result.checks.securityScan.passed).toBe(false);
    });

    it('should fail capability validation for missing required capabilities', async () => {
      const workflowWithRules = new ModuleApprovalWorkflow(mockPrisma, {
        requiredCapabilities: ['required-cap'],
      });

      const moduleId = 'module-1';
      const mockModule = {
        id: moduleId,
        name: 'Module',
        description: 'A module',
        vendorId: 'vendor-1',
        capabilities: ['other-cap'],
        price: 99.99,
        licenseType: LicenseType.SUBSCRIPTION,
      };

      const mockVendor = {
        id: 'profile-1',
        vendorId: 'vendor-1',
        kycStatus: KYCStatus.VERIFIED,
        reputationScore: 85,
      };

      jest.spyOn(MarketplaceModule, 'getModule').mockResolvedValue(mockModule as any);
      jest.spyOn(VendorProfile, 'getVendorProfile').mockResolvedValue(mockVendor as any);

      const result = await workflowWithRules.runAutomatedChecks(moduleId);

      expect(result.passed).toBe(false);
      expect(result.checks.capabilityValidation.passed).toBe(false);
    });
  });

  describe('processApproval', () => {
    it('should approve module after manual review', async () => {
      const moduleId = 'module-1';
      const mockModule = {
        id: moduleId,
        approvalStatus: ApprovalStatus.UNDER_REVIEW,
        vendorId: 'vendor-1',
        capabilities: ['valid-cap'],
        price: 99.99,
      };

      const mockVendor = {
        id: 'profile-1',
        vendorId: 'vendor-1',
        kycStatus: KYCStatus.VERIFIED,
        reputationScore: 85,
      };

      jest.spyOn(MarketplaceModule, 'getModule').mockResolvedValue(mockModule as any);
      jest.spyOn(VendorProfile, 'getVendorProfile').mockResolvedValue(mockVendor as any);
      jest.spyOn(MarketplaceModule, 'updateApprovalStatus').mockResolvedValue({
        ...mockModule,
        approvalStatus: ApprovalStatus.APPROVED,
      } as any);

      const result = await workflow.processApproval(moduleId, {
        approved: true,
        reviewerNotes: 'Looks good',
      });

      expect(result.status).toBe(ApprovalStatus.APPROVED);
      expect(MarketplaceModule.updateApprovalStatus).toHaveBeenCalledWith(
        mockPrisma,
        moduleId,
        ApprovalStatus.APPROVED
      );
    });

    it('should reject module if automated checks fail', async () => {
      const moduleId = 'module-1';
      const mockModule = {
        id: moduleId,
        approvalStatus: ApprovalStatus.PENDING,
        vendorId: 'vendor-1',
        capabilities: ['admin-access'],
        price: 99.99,
      };

      jest.spyOn(MarketplaceModule, 'getModule').mockResolvedValue(mockModule as any);
      jest.spyOn(MarketplaceModule, 'updateApprovalStatus').mockResolvedValue({
        ...mockModule,
        approvalStatus: ApprovalStatus.REJECTED,
      } as any);

      const result = await workflow.processApproval(moduleId);

      expect(result.status).toBe(ApprovalStatus.REJECTED);
      expect(result.reason).toContain('Automated checks failed');
    });
  });
});

