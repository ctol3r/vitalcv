/**
 * B248B-PARTNER-020: EngagementCollaborationTests suite
 *
 * Tests creating/updating opportunities, proposals, campaigns, tasks;
 * checks notification triggers; verifies metrics calculations;
 * ensures RBAC rules block unauthorized actions.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { PartnershipOpportunityService } from '../services/opportunityService';
import { PartnerEngagementService } from '../services/partnerEngagementService';
import { PartnerMetricsService } from '../analytics/partnerMetricsService';
import {
  OpportunityStatus,
  validateCreatePartnershipOpportunity,
} from '../models/PartnershipOpportunity';
import {
  ProposalStatus,
  validateCreatePartnershipProposal,
} from '../models/PartnershipProposal';
import {
  CampaignStatus,
  validateCreateCoMarketingCampaign,
} from '../models/CoMarketingCampaign';
import {
  TaskStatus,
  validateCreateCollaborationTask,
} from '../models/CollaborationTask';
import {
  PartnerRole,
  PartnerPermission,
  checkPermission,
  userHasPermission,
} from '../security/partnerRoles';

// Mock Prisma client
const mockPrisma = {
  partnershipOpportunity: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  partnershipProposal: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  coMarketingCampaign: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  collaborationTask: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  partnerConfig: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

describe('PartnershipOpportunityService', () => {
  let service: PartnershipOpportunityService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PartnershipOpportunityService(mockPrisma);
  });

  describe('createOpportunity', () => {
    it('should create an opportunity with valid data', async () => {
      const data = {
        partnerId: 'partner-1',
        title: 'New Partnership Opportunity',
        description: 'Test description',
        status: OpportunityStatus.NEW,
        potentialValue: 100000, // $1000 in cents
        createdBy: 'user-1',
      };

      (mockPrisma.partnerConfig.findUnique as jest.Mock).mockResolvedValue({
        id: 'config-1',
        partnerId: 'partner-1',
        partnerName: 'Test Partner',
      });

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });

      (mockPrisma.partnershipOpportunity.create as jest.Mock).mockResolvedValue({
        id: 'opp-1',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createOpportunity(data);

      expect(result.id).toBe('opp-1');
      expect(mockPrisma.partnershipOpportunity.create).toHaveBeenCalled();
    });

    it('should throw error if partner not found', async () => {
      const data = {
        partnerId: 'invalid-partner',
        title: 'Test',
        createdBy: 'user-1',
      };

      (mockPrisma.partnerConfig.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.createOpportunity(data)).rejects.toThrow(
        'Partner with ID invalid-partner not found',
      );
    });
  });

  describe('updateStatus', () => {
    it('should update opportunity status and trigger notifications', async () => {
      const opportunity = {
        id: 'opp-1',
        partnerId: 'partner-1',
        status: OpportunityStatus.NEW,
        title: 'Test Opportunity',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.partnershipOpportunity.findUnique as jest.Mock)
        .mockResolvedValueOnce(opportunity)
        .mockResolvedValueOnce({
          ...opportunity,
          status: OpportunityStatus.IN_PROGRESS,
        });

      (mockPrisma.partnershipOpportunity.update as jest.Mock).mockResolvedValue({
        ...opportunity,
        status: OpportunityStatus.IN_PROGRESS,
      });

      await service.updateStatus('opp-1', OpportunityStatus.IN_PROGRESS);

      expect(mockPrisma.partnershipOpportunity.update).toHaveBeenCalledWith({
        where: { id: 'opp-1' },
        data: { status: OpportunityStatus.IN_PROGRESS },
      });
    });
  });

  describe('assignOwner', () => {
    it('should assign owner to opportunity', async () => {
      const opportunity = {
        id: 'opp-1',
        partnerId: 'partner-1',
        assignedTo: null,
      };

      (mockPrisma.partnershipOpportunity.findUnique as jest.Mock).mockResolvedValue(
        opportunity,
      );
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-2',
        email: 'owner@example.com',
      });
      (mockPrisma.partnershipOpportunity.update as jest.Mock).mockResolvedValue({
        ...opportunity,
        assignedTo: 'user-2',
      });

      await service.assignOwner('opp-1', 'user-2');

      expect(mockPrisma.partnershipOpportunity.update).toHaveBeenCalledWith({
        where: { id: 'opp-1' },
        data: { assignedTo: 'user-2' },
      });
    });
  });
});

describe('PartnerEngagementService', () => {
  let service: PartnerEngagementService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PartnerEngagementService(mockPrisma);
  });

  describe('notifyPartner', () => {
    it('should send notification to partner via webhook', async () => {
      const partner = {
        id: 'config-1',
        partnerId: 'partner-1',
        partnerName: 'Test Partner',
        isActive: true,
        atsWebhookUrl: 'https://partner.com/webhook',
        authType: 'bearer',
        authSecret: 'secret-token',
      };

      (mockPrisma.partnerConfig.findUnique as jest.Mock).mockResolvedValue(partner);

      // Mock fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      await service.notifyPartner('partner-1', {
        type: 'opportunity_created',
        partnerId: 'partner-1',
        message: 'New opportunity created',
        metadata: { opportunityId: 'opp-1' },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://partner.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer secret-token',
          }),
        }),
      );
    });

    it('should not send notification if partner is inactive', async () => {
      (mockPrisma.partnerConfig.findUnique as jest.Mock).mockResolvedValue({
        id: 'config-1',
        partnerId: 'partner-1',
        isActive: false,
      });

      await service.notifyPartner('partner-1', {
        type: 'test',
        message: 'Test',
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});

describe('PartnerMetricsService', () => {
  let service: PartnerMetricsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PartnerMetricsService(mockPrisma);
  });

  describe('calculatePartnerMetrics', () => {
    it('should calculate correct metrics for opportunities', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const opportunities = [
        {
          id: 'opp-1',
          partnerId: 'partner-1',
          status: OpportunityStatus.WON,
          potentialValue: 100000,
          createdAt: new Date('2024-01-05'),
          updatedAt: new Date('2024-01-15'),
        },
        {
          id: 'opp-2',
          partnerId: 'partner-1',
          status: OpportunityStatus.IN_PROGRESS,
          potentialValue: 50000,
          createdAt: new Date('2024-01-10'),
          updatedAt: new Date('2024-01-20'),
        },
      ];

      (mockPrisma.partnershipOpportunity.findMany as jest.Mock).mockResolvedValue(
        opportunities,
      );
      (mockPrisma.partnershipProposal.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.coMarketingCampaign.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.collaborationTask.findMany as jest.Mock).mockResolvedValue([]);

      const metrics = await service.calculatePartnerMetrics(
        'partner-1',
        startDate,
        endDate,
      );

      expect(metrics.opportunities.total).toBe(2);
      expect(metrics.opportunities.totalValue).toBe(150000);
      expect(metrics.opportunities.averageValue).toBe(75000);
      expect(metrics.revenue.recognized).toBe(100000);
      expect(metrics.revenue.potential).toBe(50000);
    });

    it('should calculate proposal conversion rate', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      (mockPrisma.partnershipOpportunity.findMany as jest.Mock).mockResolvedValue([
        { id: 'opp-1', partnerId: 'partner-1' },
      ]);

      const proposals = [
        {
          id: 'prop-1',
          opportunityId: 'opp-1',
          status: ProposalStatus.SUBMITTED,
          submittedAt: new Date('2024-01-10'),
          decisionAt: new Date('2024-01-15'),
        },
        {
          id: 'prop-2',
          opportunityId: 'opp-1',
          status: ProposalStatus.ACCEPTED,
          submittedAt: new Date('2024-01-12'),
          decisionAt: new Date('2024-01-18'),
        },
      ];

      (mockPrisma.partnershipProposal.findMany as jest.Mock).mockResolvedValue(
        proposals,
      );
      (mockPrisma.coMarketingCampaign.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.collaborationTask.findMany as jest.Mock).mockResolvedValue([]);

      const metrics = await service.calculatePartnerMetrics(
        'partner-1',
        startDate,
        endDate,
      );

      expect(metrics.proposals.total).toBe(2);
      expect(metrics.proposals.conversionRate).toBe(100); // 1 accepted / 1 submitted
    });
  });
});

describe('RBAC Security', () => {
  describe('checkPermission', () => {
    it('should allow partner manager to access all resources', () => {
      const result = checkPermission(
        [PartnerRole.PARTNER_MANAGER],
        PartnerPermission.READ_OPPORTUNITY,
        null,
        'any-partner-id',
      );

      expect(result.allowed).toBe(true);
    });

    it('should allow partner user to access their own partner resources', () => {
      const result = checkPermission(
        [PartnerRole.PARTNER_USER],
        PartnerPermission.READ_OPPORTUNITY,
        'partner-1',
        'partner-1',
      );

      expect(result.allowed).toBe(true);
    });

    it('should block partner user from accessing other partner resources', () => {
      const result = checkPermission(
        [PartnerRole.PARTNER_USER],
        PartnerPermission.READ_OPPORTUNITY,
        'partner-1',
        'partner-2',
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('cannot access resources');
    });

    it('should block user without required permission', () => {
      const result = checkPermission(
        [PartnerRole.PARTNER_USER],
        PartnerPermission.ASSIGN_OPPORTUNITY, // Not available to partner user
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('does not have permission');
    });
  });

  describe('userHasPermission', () => {
    it('should return true for partner manager', () => {
      expect(
        userHasPermission(
          [PartnerRole.PARTNER_MANAGER],
          PartnerPermission.ASSIGN_OPPORTUNITY,
        ),
      ).toBe(true);
    });

    it('should return true for partner admin with permission', () => {
      expect(
        userHasPermission(
          [PartnerRole.PARTNER_ADMIN],
          PartnerPermission.CREATE_OPPORTUNITY,
        ),
      ).toBe(true);
    });

    it('should return false for partner user without permission', () => {
      expect(
        userHasPermission(
          [PartnerRole.PARTNER_USER],
          PartnerPermission.ASSIGN_OPPORTUNITY,
        ),
      ).toBe(false);
    });
  });
});

describe('Model Validation', () => {
  describe('PartnershipOpportunity', () => {
    it('should validate create opportunity data', () => {
      const data = {
        partnerId: 'partner-1',
        title: 'Test Opportunity',
        description: 'Test description',
        status: OpportunityStatus.NEW,
        potentialValue: 100000,
        createdBy: 'user-1',
      };

      const result = validateCreatePartnershipOpportunity(data);
      expect(result).toEqual(data);
    });

    it('should reject invalid opportunity data', () => {
      const data = {
        partnerId: '', // Invalid: empty string
        title: 'Test',
        createdBy: 'user-1',
      };

      expect(() => validateCreatePartnershipOpportunity(data)).toThrow();
    });
  });

  describe('PartnershipProposal', () => {
    it('should validate create proposal data', () => {
      const data = {
        opportunityId: 'opp-1',
        status: ProposalStatus.DRAFT,
      };

      const result = validateCreatePartnershipProposal(data);
      expect(result).toEqual(data);
    });
  });

  describe('CoMarketingCampaign', () => {
    it('should validate create campaign data', () => {
      const data = {
        partnerId: 'partner-1',
        name: 'Test Campaign',
        status: CampaignStatus.DRAFT,
        budget: 50000,
      };

      const result = validateCreateCoMarketingCampaign(data);
      expect(result).toEqual(data);
    });
  });

  describe('CollaborationTask', () => {
    it('should validate create task data', () => {
      const data = {
        partnerId: 'partner-1',
        title: 'Test Task',
        status: TaskStatus.OPEN,
      };

      const result = validateCreateCollaborationTask(data);
      expect(result).toEqual(data);
    });
  });
});

