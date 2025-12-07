/**
 * B240A-VM-010: VendorCoreTests
 *
 * End-to-end tests covering vendor creation, onboarding flows, contract management,
 * document uploads; ensures models and services operate correctly
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient, VendorStatus, OnboardingStatus, ContractStatus, DocumentType } from '@prisma/client';
import {
  createVendor,
  getVendor,
  updateVendor,
  archiveVendor,
  deleteVendor,
} from '../models/Vendor.js';
import {
  createVendorContact,
  getVendorContacts,
  updateVendorContact,
  deleteVendorContact,
} from '../models/VendorContact.js';
import {
  createVendorOnboardingFlow,
  getVendorOnboardingFlow,
  updateOnboardingStep,
  completeChecklistItem,
} from '../models/VendorOnboardingFlow.js';
import {
  createVendorCategory,
  getVendorCategory,
  listVendorCategories,
} from '../models/VendorCategory.js';
import {
  createContractLibrary,
  getContractLibrary,
  listContractLibraries,
} from '../models/ContractLibrary.js';
import { VendorProfileService } from '../services/vendorProfileService.js';
import { ContractManagementService } from '../services/contractManagementService.js';
import {
  uploadVendorDocument,
  listVendorDocuments,
  getVendorDocument,
} from '../storage/vendorDocumentStorage.js';

// Use test database or mock Prisma client
const prisma = new PrismaClient();

describe('Vendor Core Tests', () => {
  let testOrgId: string;
  let testCategoryId: string;
  let testVendorId: string;
  let testContactId: string;
  let testContractTemplateId: string;

  beforeEach(async () => {
    // Create test organization (mock)
    testOrgId = 'test-org-' + Date.now();

    // Create test category
    const category = await createVendorCategory(prisma, {
      name: 'Test Category',
      description: 'Test category for vendor tests',
    });
    testCategoryId = category.id;

    // Create test contract template
    const template = await createContractLibrary(prisma, {
      name: 'Test Contract Template',
      content: '<h1>Test Contract</h1><p>This is a test contract template.</p>',
      effectiveDate: new Date(),
      jurisdiction: 'US',
    });
    testContractTemplateId = template.id;
  });

  afterEach(async () => {
    // Cleanup test data
    try {
      if (testVendorId) {
        await deleteVendor(prisma, testVendorId);
      }
      if (testCategoryId) {
        await prisma.vendorCategory.delete({ where: { id: testCategoryId } }).catch(() => {});
      }
      if (testContractTemplateId) {
        await prisma.contractLibrary.delete({ where: { id: testContractTemplateId } }).catch(() => {});
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Vendor Model', () => {
    it('should create a vendor', async () => {
      const vendor = await createVendor(prisma, {
        name: 'Test Vendor',
        orgId: testOrgId,
        categoryId: testCategoryId,
        status: VendorStatus.PENDING,
        description: 'A test vendor',
        website: 'https://testvendor.com',
      });

      expect(vendor).toBeDefined();
      expect(vendor.name).toBe('Test Vendor');
      expect(vendor.status).toBe(VendorStatus.PENDING);
      testVendorId = vendor.id;
    });

    it('should get vendor by ID', async () => {
      const vendor = await createVendor(prisma, {
        name: 'Test Vendor',
        orgId: testOrgId,
        categoryId: testCategoryId,
      });
      testVendorId = vendor.id;

      const retrieved = await getVendor(prisma, vendor.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(vendor.id);
      expect(retrieved?.name).toBe('Test Vendor');
    });

    it('should update vendor', async () => {
      const vendor = await createVendor(prisma, {
        name: 'Test Vendor',
        orgId: testOrgId,
        categoryId: testCategoryId,
      });
      testVendorId = vendor.id;

      const updated = await updateVendor(prisma, vendor.id, {
        name: 'Updated Vendor',
        status: VendorStatus.ACTIVE,
      });

      expect(updated.name).toBe('Updated Vendor');
      expect(updated.status).toBe(VendorStatus.ACTIVE);
    });

    it('should archive vendor', async () => {
      const vendor = await createVendor(prisma, {
        name: 'Test Vendor',
        orgId: testOrgId,
        categoryId: testCategoryId,
        status: VendorStatus.ACTIVE,
      });
      testVendorId = vendor.id;

      const archived = await archiveVendor(prisma, vendor.id);
      expect(archived.status).toBe(VendorStatus.INACTIVE);
    });

    it('should validate vendor input', () => {
      expect(() => {
        createVendor(prisma, {
          name: '',
          orgId: testOrgId,
          categoryId: testCategoryId,
        } as any);
      }).rejects.toThrow('name is required');
    });
  });

  describe('VendorContact Model', () => {
    beforeEach(async () => {
      const vendor = await createVendor(prisma, {
        name: 'Test Vendor',
        orgId: testOrgId,
        categoryId: testCategoryId,
      });
      testVendorId = vendor.id;
    });

    it('should create vendor contact', async () => {
      const contact = await createVendorContact(prisma, {
        vendorId: testVendorId,
        name: 'John Doe',
        role: 'Account Manager',
        email: 'john@testvendor.com',
        phone: '+1234567890',
      });

      expect(contact).toBeDefined();
      expect(contact.name).toBe('John Doe');
      expect(contact.email).toBe('john@testvendor.com');
      testContactId = contact.id;
    });

    it('should get all contacts for vendor', async () => {
      await createVendorContact(prisma, {
        vendorId: testVendorId,
        name: 'Contact 1',
        email: 'contact1@test.com',
      });
      await createVendorContact(prisma, {
        vendorId: testVendorId,
        name: 'Contact 2',
        email: 'contact2@test.com',
      });

      const contacts = await getVendorContacts(prisma, testVendorId);
      expect(contacts.length).toBeGreaterThanOrEqual(2);
    });

    it('should update vendor contact', async () => {
      const contact = await createVendorContact(prisma, {
        vendorId: testVendorId,
        name: 'John Doe',
        email: 'john@test.com',
      });

      const updated = await updateVendorContact(prisma, contact.id, {
        email: 'john.updated@test.com',
      });

      expect(updated.email).toBe('john.updated@test.com');
    });
  });

  describe('VendorOnboardingFlow Model', () => {
    beforeEach(async () => {
      const vendor = await createVendor(prisma, {
        name: 'Test Vendor',
        orgId: testOrgId,
        categoryId: testCategoryId,
      });
      testVendorId = vendor.id;
    });

    it('should create onboarding flow', async () => {
      const flow = await createVendorOnboardingFlow(prisma, {
        vendorId: testVendorId,
        currentStep: 'initial',
        status: OnboardingStatus.NOT_STARTED,
        checklist: [
          {
            id: 'step-1',
            step: 'initial',
            title: 'Initial Setup',
            completed: false,
          },
        ],
      });

      expect(flow).toBeDefined();
      expect(flow.vendorId).toBe(testVendorId);
      expect(flow.status).toBe(OnboardingStatus.NOT_STARTED);
    });

    it('should update onboarding step', async () => {
      const flow = await createVendorOnboardingFlow(prisma, {
        vendorId: testVendorId,
      });

      const updated = await updateOnboardingStep(
        prisma,
        testVendorId,
        'documentation',
        OnboardingStatus.IN_PROGRESS
      );

      expect(updated.currentStep).toBe('documentation');
      expect(updated.status).toBe(OnboardingStatus.IN_PROGRESS);
    });

    it('should complete checklist item', async () => {
      const checklist = [
        {
          id: 'item-1',
          step: 'initial',
          title: 'Complete Profile',
          completed: false,
        },
      ];

      await createVendorOnboardingFlow(prisma, {
        vendorId: testVendorId,
        checklist,
      });

      const updated = await completeChecklistItem(prisma, testVendorId, 'item-1', 'Completed');

      const updatedChecklist = updated.checklist as any[];
      const item = updatedChecklist.find((i) => i.id === 'item-1');
      expect(item?.completed).toBe(true);
      expect(item?.notes).toBe('Completed');
    });
  });

  describe('VendorProfileService', () => {
    let service: VendorProfileService;

    beforeEach(() => {
      service = new VendorProfileService(prisma);
    });

    it('should create vendor profile', async () => {
      const vendor = await service.createVendorProfile(testOrgId, {
        name: 'Service Test Vendor',
        categoryId: testCategoryId,
        description: 'Created via service',
      });

      expect(vendor).toBeDefined();
      expect(vendor.name).toBe('Service Test Vendor');
      testVendorId = vendor.id;
    });

    it('should merge vendor from external data', async () => {
      const vendor = await service.mergeVendorFromExternal(
        testOrgId,
        {
          name: 'External Vendor',
          category: 'Test Category',
          description: 'Imported from external system',
          website: 'https://external.com',
          contacts: [
            {
              name: 'External Contact',
              email: 'contact@external.com',
            },
          ],
        },
        {
          createCategoryIfMissing: false,
          defaultCategoryName: 'Test Category',
        }
      );

      expect(vendor).toBeDefined();
      expect(vendor.name).toBe('External Vendor');

      const contacts = await getVendorContacts(prisma, vendor.id);
      expect(contacts.length).toBeGreaterThan(0);
      testVendorId = vendor.id;
    });

    it('should get vendor with relations', async () => {
      const vendor = await service.createVendorProfile(testOrgId, {
        name: 'Test Vendor',
        categoryId: testCategoryId,
      });
      testVendorId = vendor.id;

      await createVendorContact(prisma, {
        vendorId: vendor.id,
        name: 'Test Contact',
        email: 'test@test.com',
      });

      const vendorWithRelations = await service.getVendorWithRelations(vendor.id);
      expect(vendorWithRelations).toBeDefined();
      expect(vendorWithRelations?.contacts).toBeDefined();
      expect(vendorWithRelations?.contacts.length).toBeGreaterThan(0);
    });
  });

  describe('ContractManagementService', () => {
    let service: ContractManagementService;

    beforeEach(async () => {
      service = new ContractManagementService(prisma);
      const vendor = await createVendor(prisma, {
        name: 'Contract Test Vendor',
        orgId: testOrgId,
        categoryId: testCategoryId,
      });
      testVendorId = vendor.id;
    });

    it('should select contract template', async () => {
      const templateId = await service.selectContractTemplate(testVendorId, 'US');
      expect(templateId).toBeDefined();
    });

    it('should generate contract draft', async () => {
      const draft = await service.generateContractDraft({
        vendorId: testVendorId,
        templateId: testContractTemplateId,
      });

      expect(draft).toBeDefined();
      expect(draft.id).toBeDefined();
      expect(draft.content).toBeDefined();
      expect(draft.status).toBe(ContractStatus.DRAFT);
    });

    it('should track contract signature', async () => {
      const draft = await service.generateContractDraft({
        vendorId: testVendorId,
        templateId: testContractTemplateId,
      });

      await service.trackContractSignature(draft.id, new Date());

      const contract = await prisma.vendorContract.findUnique({
        where: { id: draft.id },
      });

      expect(contract?.status).toBe(ContractStatus.SIGNED);
      expect(contract?.signedAt).toBeDefined();
    });

    it('should get contracts expiring soon', async () => {
      const draft = await service.generateContractDraft({
        vendorId: testVendorId,
        templateId: testContractTemplateId,
      });

      await service.trackContractSignature(draft.id, new Date());

      // Set expiry date to 30 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await prisma.vendorContract.update({
        where: { id: draft.id },
        data: { expiresAt },
      });

      const expiring = await service.getContractsExpiringSoon(90);
      expect(expiring.length).toBeGreaterThan(0);
    });
  });

  describe('VendorDocumentStorage', () => {
    beforeEach(async () => {
      const vendor = await createVendor(prisma, {
        name: 'Document Test Vendor',
        orgId: testOrgId,
        categoryId: testCategoryId,
      });
      testVendorId = vendor.id;
    });

    it('should upload vendor document', async () => {
      const fileData = Buffer.from('Test document content');
      const document = await uploadVendorDocument(prisma, {
        vendorId: testVendorId,
        docType: DocumentType.CERTIFICATE,
        title: 'Test Certificate',
        description: 'A test certificate',
        fileName: 'test-cert.pdf',
        mimeType: 'application/pdf',
        fileData,
        uploadedBy: 'test-user',
      });

      expect(document).toBeDefined();
      expect(document.vendorId).toBe(testVendorId);
      expect(document.docType).toBe(DocumentType.CERTIFICATE);
      expect(document.encrypted).toBe(true);
    });

    it('should list vendor documents', async () => {
      const fileData = Buffer.from('Test document');
      await uploadVendorDocument(prisma, {
        vendorId: testVendorId,
        docType: DocumentType.CERTIFICATE,
        title: 'Certificate 1',
        fileName: 'cert1.pdf',
        mimeType: 'application/pdf',
        fileData,
        uploadedBy: 'test-user',
      });

      await uploadVendorDocument(prisma, {
        vendorId: testVendorId,
        docType: DocumentType.POLICY,
        title: 'Policy 1',
        fileName: 'policy1.pdf',
        mimeType: 'application/pdf',
        fileData,
        uploadedBy: 'test-user',
      });

      const documents = await listVendorDocuments(prisma, testVendorId);
      expect(documents.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter documents by type', async () => {
      const fileData = Buffer.from('Test document');
      await uploadVendorDocument(prisma, {
        vendorId: testVendorId,
        docType: DocumentType.CERTIFICATE,
        title: 'Certificate',
        fileName: 'cert.pdf',
        mimeType: 'application/pdf',
        fileData,
        uploadedBy: 'test-user',
      });

      const certificates = await listVendorDocuments(prisma, testVendorId, {
        docType: DocumentType.CERTIFICATE,
      });

      expect(certificates.length).toBeGreaterThan(0);
      expect(certificates.every((d) => d.docType === DocumentType.CERTIFICATE)).toBe(true);
    });
  });
});

