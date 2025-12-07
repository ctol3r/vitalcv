/**
 * B248A-PARTNER-010: PartnerCoreTests suite
 *
 * Tests for creating/updating partners, contact persons, agreements; checks lifecycle transitions;
 * verifies document upload; ensures audit logs are recorded; uses in-memory DB or test containers
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PrismaClient, PartnerStatus, AgreementType, AgreementStatus, AuditAction } from '@prisma/client';
import * as PartnerProfile from '../models/PartnerProfile.js';
import * as ContactPerson from '../models/ContactPerson.js';
import * as PartnershipAgreement from '../models/PartnershipAgreement.js';
import * as PartnershipPolicy from '../models/PartnershipPolicy.js';
import { PartnerRegistrationService } from '../services/partnerRegistrationService.js';
import { PartnerDocumentUploadService } from '../services/partnerDocumentUploadService.js';
import { PartnerAuditLogService } from '../services/partnerAuditLogService.js';
import {
  canTransition,
  validateTransition,
  getValidNextStatuses,
} from '../models/PartnerStatus.js';

// Mock Prisma client
const mockPrisma = {
  partnerProfile: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  contactPerson: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  partnershipAgreement: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  partnershipPolicy: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  partnerAuditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

describe('PartnerProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPartnerProfile', () => {
    it('should create a partner profile with valid data', async () => {
      const input: PartnerProfile.PartnerProfileInput = {
        name: 'Test Clinic',
        type: 'clinic',
        industry: 'Healthcare',
        website: 'https://testclinic.com',
        contactEmail: 'contact@testclinic.com',
        phone: '555-1234',
        status: PartnerStatus.draft,
      };

      const mockPartner = {
        id: 'partner-1',
        ...input,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.partnerProfile.create as jest.Mock).mockResolvedValue(mockPartner);

      const result = await PartnerProfile.createPartnerProfile(mockPrisma, input);

      expect(result).toEqual(mockPartner);
      expect(mockPrisma.partnerProfile.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: input.name,
          type: input.type,
          status: PartnerStatus.draft,
        }),
      });
    });

    it('should throw error for invalid email', async () => {
      const input: PartnerProfile.PartnerProfileInput = {
        name: 'Test Clinic',
        type: 'clinic',
        contactEmail: 'invalid-email',
      };

      await expect(PartnerProfile.createPartnerProfile(mockPrisma, input)).rejects.toThrow(
        'contactEmail must be a valid email address'
      );
    });

    it('should throw error for invalid type', async () => {
      const input: PartnerProfile.PartnerProfileInput = {
        name: 'Test Clinic',
        type: 'invalid' as any,
      };

      await expect(PartnerProfile.createPartnerProfile(mockPrisma, input)).rejects.toThrow(
        'type must be one of'
      );
    });
  });

  describe('updatePartnerProfile', () => {
    it('should update partner profile', async () => {
      const existing = {
        id: 'partner-1',
        name: 'Old Name',
        type: 'clinic',
        status: PartnerStatus.draft,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updated = {
        ...existing,
        name: 'New Name',
        updatedAt: new Date(),
      };

      (mockPrisma.partnerProfile.findUnique as jest.Mock).mockResolvedValue(existing);
      (mockPrisma.partnerProfile.update as jest.Mock).mockResolvedValue(updated);

      const result = await PartnerProfile.updatePartnerProfile(mockPrisma, 'partner-1', {
        name: 'New Name',
      });

      expect(result.name).toBe('New Name');
    });
  });
});

describe('ContactPerson', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createContactPerson', () => {
    it('should create a contact person with valid data', async () => {
      const partnerId = 'partner-1';
      const input: ContactPerson.ContactPersonInput = {
        partnerId,
        name: 'John Doe',
        title: 'CTO',
        email: 'john@example.com',
        phone: '555-5678',
        role: 'technical',
      };

      const mockContact = {
        id: 'contact-1',
        ...input,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.partnerProfile.findUnique as jest.Mock).mockResolvedValue({
        id: partnerId,
        name: 'Test Partner',
      });
      (mockPrisma.contactPerson.create as jest.Mock).mockResolvedValue(mockContact);

      const result = await ContactPerson.createContactPerson(mockPrisma, input);

      expect(result).toEqual(mockContact);
      expect(mockPrisma.contactPerson.create).toHaveBeenCalled();
    });

    it('should throw error if partner does not exist', async () => {
      const input: ContactPerson.ContactPersonInput = {
        partnerId: 'non-existent',
        name: 'John Doe',
        role: 'admin',
      };

      (mockPrisma.partnerProfile.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(ContactPerson.createContactPerson(mockPrisma, input)).rejects.toThrow(
        'Partner not found'
      );
    });
  });
});

describe('PartnershipAgreement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPartnershipAgreement', () => {
    it('should create an agreement with valid data', async () => {
      const partnerId = 'partner-1';
      const input: PartnershipAgreement.PartnershipAgreementInput = {
        partnerId,
        agreementType: AgreementType.contract,
        documentId: 'doc-123',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        status: AgreementStatus.draft,
      };

      const mockAgreement = {
        id: 'agreement-1',
        ...input,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.partnerProfile.findUnique as jest.Mock).mockResolvedValue({
        id: partnerId,
        name: 'Test Partner',
      });
      (mockPrisma.partnershipAgreement.create as jest.Mock).mockResolvedValue(mockAgreement);

      const result = await PartnershipAgreement.createPartnershipAgreement(mockPrisma, input);

      expect(result).toEqual(mockAgreement);
    });

    it('should throw error if startDate is after endDate', async () => {
      const input: PartnershipAgreement.PartnershipAgreementInput = {
        partnerId: 'partner-1',
        agreementType: AgreementType.contract,
        startDate: new Date('2024-12-31'),
        endDate: new Date('2024-01-01'),
      };

      await expect(
        PartnershipAgreement.createPartnershipAgreement(mockPrisma, input)
      ).rejects.toThrow('startDate must be before endDate');
    });
  });
});

describe('PartnerStatus lifecycle', () => {
  describe('canTransition', () => {
    it('should allow valid transitions', () => {
      expect(canTransition(PartnerStatus.draft, PartnerStatus.under_review)).toBe(true);
      expect(canTransition(PartnerStatus.under_review, PartnerStatus.approved)).toBe(true);
      expect(canTransition(PartnerStatus.approved, PartnerStatus.active)).toBe(true);
      expect(canTransition(PartnerStatus.active, PartnerStatus.suspended)).toBe(true);
    });

    it('should reject invalid transitions', () => {
      expect(canTransition(PartnerStatus.draft, PartnerStatus.active)).toBe(false);
      expect(canTransition(PartnerStatus.terminated, PartnerStatus.active)).toBe(false);
    });
  });

  describe('validateTransition', () => {
    it('should not throw for valid transitions', () => {
      expect(() => validateTransition(PartnerStatus.draft, PartnerStatus.under_review)).not.toThrow();
    });

    it('should throw for invalid transitions', () => {
      expect(() => validateTransition(PartnerStatus.draft, PartnerStatus.active)).toThrow();
    });
  });

  describe('getValidNextStatuses', () => {
    it('should return valid next statuses', () => {
      const nextStatuses = getValidNextStatuses(PartnerStatus.draft);
      expect(nextStatuses).toContain(PartnerStatus.under_review);
      expect(nextStatuses).toContain(PartnerStatus.draft);
    });
  });
});

describe('PartnerRegistrationService', () => {
  let service: PartnerRegistrationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PartnerRegistrationService(mockPrisma);
  });

  describe('registerPartner', () => {
    it('should register a new partner with default contact person', async () => {
      const input = {
        profile: {
          name: 'New Clinic',
          type: 'clinic' as const,
          industry: 'Healthcare',
        },
        primaryContact: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          role: 'admin' as const,
        },
      };

      const mockPartner = {
        id: 'partner-1',
        name: input.profile.name,
        type: input.profile.type,
        status: PartnerStatus.under_review,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockContact = {
        id: 'contact-1',
        partnerId: 'partner-1',
        name: input.primaryContact.name,
        role: input.primaryContact.role,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.partnerProfile.create as jest.Mock).mockResolvedValue(mockPartner);
      (mockPrisma.partnerProfile.findUnique as jest.Mock).mockResolvedValue(mockPartner);
      (mockPrisma.contactPerson.create as jest.Mock).mockResolvedValue(mockContact);

      const result = await service.registerPartner(input);

      expect(result.partnerId).toBe('partner-1');
      expect(result.status).toBe(PartnerStatus.under_review);
      expect(mockPrisma.partnerProfile.create).toHaveBeenCalled();
      expect(mockPrisma.contactPerson.create).toHaveBeenCalled();
    });
  });
});

describe('PartnerAuditLogService', () => {
  let service: PartnerAuditLogService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PartnerAuditLogService(mockPrisma);
  });

  describe('logEvent', () => {
    it('should log an audit event', async () => {
      const entry = {
        entityType: 'PartnerProfile' as const,
        entityId: 'partner-1',
        partnerId: 'partner-1',
        action: AuditAction.create,
        userId: 'user-1',
        changes: { name: 'New Partner' },
      };

      (mockPrisma.partnerAuditLog.create as jest.Mock).mockResolvedValue({
        id: 'log-1',
        ...entry,
        timestamp: new Date(),
      });

      await service.logEvent(entry);

      expect(mockPrisma.partnerAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entityType: entry.entityType,
          entityId: entry.entityId,
          action: entry.action,
        }),
      });
    });
  });

  describe('logPartnerProfileCreated', () => {
    it('should log partner profile creation', async () => {
      (mockPrisma.partnerAuditLog.create as jest.Mock).mockResolvedValue({
        id: 'log-1',
        timestamp: new Date(),
      });

      await service.logPartnerProfileCreated('partner-1', { name: 'Test' }, 'user-1');

      expect(mockPrisma.partnerAuditLog.create).toHaveBeenCalled();
    });
  });
});

describe('PartnerDocumentUploadService', () => {
  let service: PartnerDocumentUploadService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PartnerDocumentUploadService(mockPrisma);
  });

  describe('uploadDocument', () => {
    it('should upload a document for an agreement', async () => {
      const agreementId = 'agreement-1';
      const mockAgreement = {
        id: agreementId,
        partnerId: 'partner-1',
        agreementType: AgreementType.contract,
        documentId: null,
      };

      (mockPrisma.partnershipAgreement.findUnique as jest.Mock).mockResolvedValue(mockAgreement);
      (mockPrisma.partnershipAgreement.update as jest.Mock).mockResolvedValue({
        ...mockAgreement,
        documentId: 'doc-123',
      });

      const result = await service.uploadDocument(
        agreementId,
        Buffer.from('test content'),
        {
          filename: 'agreement.pdf',
          contentType: 'application/pdf',
          size: 1024,
        }
      );

      expect(result.documentId).toBeDefined();
      expect(result.version).toBe(1);
    });

    it('should throw error if agreement does not exist', async () => {
      (mockPrisma.partnershipAgreement.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.uploadDocument('non-existent', Buffer.from('test'), {
          filename: 'test.pdf',
          contentType: 'application/pdf',
          size: 1024,
        })
      ).rejects.toThrow('Partnership agreement not found');
    });
  });
});

