/**
 * B251A-CON-010: ContractModelsTests suite
 *
 * Comprehensive tests verifying Contract, ContractVersion, Party, Template, Variable,
 * ChangeRequest, AuditLog, Tag, Schedule models: creation, relationships, validations
 * (unique slugs, required fields, FK constraints)
 */

import { PrismaClient, ContractType, ContractStatus, ContractPartyRole, SignatureStatus, VariableValueType, ChangeRequestStatus, ContractEventType, MilestoneStatus } from '@prisma/client';
import {
  createContract,
  getContract,
  getContractBySlug,
  listContracts,
  updateContract,
  deleteContract,
  updateContractCurrentVersion,
} from '../models/Contract.js';
import {
  createContractVersion,
  getContractVersion,
  listContractVersions,
  getLatestContractVersion,
  publishContractVersion,
  getNextVersionNumber,
} from '../models/ContractVersion.js';
import {
  createContractParty,
  getContractParty,
  listContractParties,
  updatePartySignatureStatus,
  updateContractParty,
  deleteContractParty,
  validatePartyIdentity,
} from '../models/ContractParty.js';
import {
  createContractTemplate,
  getContractTemplate,
  getContractTemplateBySlug,
  listContractTemplates,
  updateContractTemplate,
  deleteContractTemplate,
  validateTemplateSlug,
  validateTemplateContent,
} from '../models/ContractTemplate.js';
import {
  createContractVariable,
  getContractVariable,
  listContractVariables,
  updateContractVariable,
  deleteContractVariable,
  validateVariableName,
} from '../models/ContractVariable.js';
import {
  createContractChangeRequest,
  getContractChangeRequest,
  listContractChangeRequests,
  approveChangeRequest,
  rejectChangeRequest,
  updateContractChangeRequest,
} from '../models/ContractChangeRequest.js';
import {
  createContractAuditLog,
  getContractAuditLog,
  listContractAuditLogs,
  getAuditLogsByEventType,
} from '../models/ContractAuditLog.js';
import {
  createContractTag,
  getContractTag,
  getContractTagBySlug,
  listContractTags,
  updateContractTag,
  deleteContractTag,
  addTagToContract,
  removeTagFromContract,
  getContractTags,
  validateTagSlug,
} from '../models/ContractTag.js';
import {
  createContractSchedule,
  getContractSchedule,
  listContractSchedules,
  getOverdueMilestones,
  completeMilestone,
  updateContractSchedule,
  deleteContractSchedule,
} from '../models/ContractSchedule.js';

describe('Contract Models Tests', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data in reverse order of dependencies
    await prisma.contractSchedule.deleteMany({});
    await prisma.contractTagMap.deleteMany({});
    await prisma.contractTag.deleteMany({});
    await prisma.contractAuditLog.deleteMany({});
    await prisma.contractChangeRequest.deleteMany({});
    await prisma.contractParty.deleteMany({});
    await prisma.contractVersion.deleteMany({});
    await prisma.contract.deleteMany({});
    await prisma.contractVariable.deleteMany({});
    await prisma.contractTemplate.deleteMany({});
  });

  describe('Contract Model', () => {
    it('should create a contract with required fields', async () => {
      const input = {
        title: 'Service Agreement',
        slug: 'service-agreement-001',
        type: ContractType.SERVICE,
        authorId: 'user123',
      };

      const contract = await createContract(prisma, input);

      expect(contract).toBeDefined();
      expect(contract.id).toBeDefined();
      expect(contract.title).toBe(input.title);
      expect(contract.slug).toBe(input.slug);
      expect(contract.type).toBe(input.type);
      expect(contract.status).toBe(ContractStatus.DRAFT);
      expect(contract.authorId).toBe(input.authorId);
    });

    it('should enforce unique slug', async () => {
      const input = {
        title: 'Test Contract',
        slug: 'test-contract',
        type: ContractType.NDA,
        authorId: 'user123',
      };

      await createContract(prisma, input);

      await expect(createContract(prisma, input)).rejects.toThrow('already exists');
    });

    it('should validate slug format', async () => {
      const input = {
        title: 'Test',
        slug: 'Invalid Slug!', // Invalid: contains uppercase and special chars
        type: ContractType.SERVICE,
        authorId: 'user123',
      };

      await expect(createContract(prisma, input)).rejects.toThrow('Invalid slug format');
    });

    it('should get contract by slug', async () => {
      const created = await createContract(prisma, {
        title: 'Test',
        slug: 'test-slug',
        type: ContractType.SERVICE,
        authorId: 'user123',
      });

      const retrieved = await getContractBySlug(prisma, 'test-slug');
      expect(retrieved?.id).toBe(created.id);
    });

    it('should update contract', async () => {
      const created = await createContract(prisma, {
        title: 'Original',
        slug: 'original',
        type: ContractType.SERVICE,
        authorId: 'user123',
      });

      const updated = await updateContract(prisma, created.id, {
        title: 'Updated',
        status: ContractStatus.ACTIVE,
      });

      expect(updated.title).toBe('Updated');
      expect(updated.status).toBe(ContractStatus.ACTIVE);
    });

    it('should delete contract', async () => {
      const created = await createContract(prisma, {
        title: 'To Delete',
        slug: 'to-delete',
        type: ContractType.SERVICE,
        authorId: 'user123',
      });

      await deleteContract(prisma, created.id);

      const retrieved = await getContract(prisma, created.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('ContractVersion Model', () => {
    let contractId: string;

    beforeEach(async () => {
      const contract = await createContract(prisma, {
        title: 'Test Contract',
        slug: 'test-contract-version',
        type: ContractType.SERVICE,
        authorId: 'user123',
      });
      contractId = contract.id;
    });

    it('should create a contract version', async () => {
      const version = await createContractVersion(prisma, {
        contractId,
        versionNumber: 1,
        content: '# Contract Version 1\n\nThis is the first version.',
        authorId: 'user123',
        changeSummary: 'Initial version',
      });

      expect(version).toBeDefined();
      expect(version.contractId).toBe(contractId);
      expect(version.versionNumber).toBe(1);
      expect(version.content).toContain('Contract Version 1');
    });

    it('should enforce unique version numbers per contract', async () => {
      await createContractVersion(prisma, {
        contractId,
        versionNumber: 1,
        content: 'Version 1',
        authorId: 'user123',
      });

      await expect(
        createContractVersion(prisma, {
          contractId,
          versionNumber: 1,
          content: 'Version 1 again',
          authorId: 'user123',
        })
      ).rejects.toThrow('already exists');
    });

    it('should list versions for a contract', async () => {
      await createContractVersion(prisma, {
        contractId,
        versionNumber: 1,
        content: 'V1',
        authorId: 'user123',
      });
      await createContractVersion(prisma, {
        contractId,
        versionNumber: 2,
        content: 'V2',
        authorId: 'user123',
      });

      const versions = await listContractVersions(prisma, contractId);
      expect(versions.length).toBe(2);
      expect(versions[0].versionNumber).toBe(2); // Should be sorted desc
    });

    it('should get next version number', async () => {
      expect(await getNextVersionNumber(prisma, contractId)).toBe(1);

      await createContractVersion(prisma, {
        contractId,
        versionNumber: 1,
        content: 'V1',
        authorId: 'user123',
      });

      expect(await getNextVersionNumber(prisma, contractId)).toBe(2);
    });

    it('should publish version and update contract currentVersionId', async () => {
      const version = await createContractVersion(prisma, {
        contractId,
        versionNumber: 1,
        content: 'Published version',
        authorId: 'user123',
      });

      await publishContractVersion(prisma, contractId, version.id);

      const contract = await getContract(prisma, contractId);
      expect(contract?.currentVersionId).toBe(version.id);
    });
  });

  describe('ContractParty Model', () => {
    let contractId: string;

    beforeEach(async () => {
      const contract = await createContract(prisma, {
        title: 'Test Contract',
        slug: 'test-contract-party',
        type: ContractType.SERVICE,
        authorId: 'user123',
      });
      contractId = contract.id;
    });

    it('should create party with organizationId', async () => {
      const party = await createContractParty(prisma, {
        contractId,
        organizationId: 'org123',
        role: ContractPartyRole.SIGNER,
        contactName: 'John Doe',
        contactEmail: 'john@example.com',
      });

      expect(party.organizationId).toBe('org123');
      expect(party.partnerId).toBeNull();
      expect(party.role).toBe(ContractPartyRole.SIGNER);
    });

    it('should create party with partnerId', async () => {
      const party = await createContractParty(prisma, {
        contractId,
        partnerId: 'partner123',
        role: ContractPartyRole.WITNESS,
      });

      expect(party.partnerId).toBe('partner123');
      expect(party.organizationId).toBeNull();
    });

    it('should reject party without organizationId or partnerId', async () => {
      await expect(
        createContractParty(prisma, {
          contractId,
          role: ContractPartyRole.SIGNER,
        } as any)
      ).rejects.toThrow('Either organizationId or partnerId must be provided');
    });

    it('should reject party with both organizationId and partnerId', async () => {
      await expect(
        createContractParty(prisma, {
          contractId,
          organizationId: 'org123',
          partnerId: 'partner123',
          role: ContractPartyRole.SIGNER,
        })
      ).rejects.toThrow('Cannot specify both');
    });

    it('should update signature status', async () => {
      const party = await createContractParty(prisma, {
        contractId,
        organizationId: 'org123',
        role: ContractPartyRole.SIGNER,
      });

      const signed = await updatePartySignatureStatus(prisma, party.id, SignatureStatus.SIGNED);
      expect(signed.signatureStatus).toBe(SignatureStatus.SIGNED);
      expect(signed.signedAt).toBeDefined();
    });
  });

  describe('ContractTemplate Model', () => {
    it('should create template with slug', async () => {
      const template = await createContractTemplate(prisma, {
        name: 'NDA Template',
        slug: 'nda-template',
        content: 'This is an NDA between {{party1}} and {{party2}}.',
        variables: ['party1', 'party2'],
      });

      expect(template.slug).toBe('nda-template');
      expect(template.variables).toBeDefined();
    });

    it('should enforce unique slug', async () => {
      await createContractTemplate(prisma, {
        name: 'Template 1',
        slug: 'unique-slug',
        content: 'Content',
      });

      await expect(
        createContractTemplate(prisma, {
          name: 'Template 2',
          slug: 'unique-slug',
          content: 'Content',
        })
      ).rejects.toThrow('already exists');
    });

    it('should validate slug format', async () => {
      await expect(
        createContractTemplate(prisma, {
          name: 'Test',
          slug: 'Invalid Slug!',
          content: 'Content',
        })
      ).rejects.toThrow('Invalid slug format');
    });

    it('should get template by slug', async () => {
      const created = await createContractTemplate(prisma, {
        name: 'Test',
        slug: 'test-template',
        content: 'Content',
      });

      const retrieved = await getContractTemplateBySlug(prisma, 'test-template');
      expect(retrieved?.id).toBe(created.id);
    });
  });

  describe('ContractVariable Model', () => {
    let templateId: string;

    beforeEach(async () => {
      const template = await createContractTemplate(prisma, {
        name: 'Test Template',
        slug: 'test-template-vars',
        content: 'Template with {{var1}}',
      });
      templateId = template.id;
    });

    it('should create variable', async () => {
      const variable = await createContractVariable(prisma, {
        templateId,
        name: 'orgName',
        description: 'Organization name',
        valueType: VariableValueType.STRING,
        required: true,
      });

      expect(variable.name).toBe('orgName');
      expect(variable.valueType).toBe(VariableValueType.STRING);
      expect(variable.required).toBe(true);
    });

    it('should enforce unique variable names per template', async () => {
      await createContractVariable(prisma, {
        templateId,
        name: 'var1',
        valueType: VariableValueType.STRING,
      });

      await expect(
        createContractVariable(prisma, {
          templateId,
          name: 'var1',
          valueType: VariableValueType.STRING,
        })
      ).rejects.toThrow('already exists');
    });

    it('should validate variable name format', async () => {
      await expect(
        createContractVariable(prisma, {
          templateId,
          name: 'invalid-name!', // Invalid: contains special chars
          valueType: VariableValueType.STRING,
        })
      ).rejects.toThrow();
    });
  });

  describe('ContractChangeRequest Model', () => {
    let contractId: string;

    beforeEach(async () => {
      const contract = await createContract(prisma, {
        title: 'Test Contract',
        slug: 'test-change-request',
        type: ContractType.SERVICE,
        authorId: 'user123',
      });
      contractId = contract.id;
    });

    it('should create change request', async () => {
      const request = await createContractChangeRequest(prisma, {
        contractId,
        requestedBy: 'user456',
        changeSummary: 'Update payment terms',
      });

      expect(request.status).toBe(ChangeRequestStatus.PENDING);
      expect(request.changeSummary).toBe('Update payment terms');
    });

    it('should approve change request', async () => {
      const request = await createContractChangeRequest(prisma, {
        contractId,
        requestedBy: 'user456',
        changeSummary: 'Update terms',
      });

      const approved = await approveChangeRequest(prisma, request.id, 'user789');
      expect(approved.status).toBe(ChangeRequestStatus.APPROVED);
      expect(approved.decisionBy).toBe('user789');
      expect(approved.decisionAt).toBeDefined();
    });
  });

  describe('ContractAuditLog Model', () => {
    let contractId: string;

    beforeEach(async () => {
      const contract = await createContract(prisma, {
        title: 'Test Contract',
        slug: 'test-audit-log',
        type: ContractType.SERVICE,
        authorId: 'user123',
      });
      contractId = contract.id;
    });

    it('should create audit log', async () => {
      const log = await createContractAuditLog(prisma, {
        contractId,
        eventType: ContractEventType.CREATED,
        userId: 'user123',
        details: { source: 'web' },
      });

      expect(log.eventType).toBe(ContractEventType.CREATED);
      expect(log.userId).toBe('user123');
    });

    it('should list audit logs for contract', async () => {
      await createContractAuditLog(prisma, {
        contractId,
        eventType: ContractEventType.CREATED,
        userId: 'user123',
      });
      await createContractAuditLog(prisma, {
        contractId,
        eventType: ContractEventType.SIGNED,
        userId: 'user456',
      });

      const logs = await listContractAuditLogs(prisma, contractId);
      expect(logs.length).toBe(2);
    });
  });

  describe('ContractTag Model', () => {
    it('should create tag', async () => {
      const tag = await createContractTag(prisma, {
        name: 'Important',
        slug: 'important',
      });

      expect(tag.name).toBe('Important');
      expect(tag.slug).toBe('important');
    });

    it('should enforce unique name and slug', async () => {
      await createContractTag(prisma, {
        name: 'Tag1',
        slug: 'tag1',
      });

      await expect(
        createContractTag(prisma, {
          name: 'Tag1',
          slug: 'tag2',
        })
      ).rejects.toThrow('already exists');

      await expect(
        createContractTag(prisma, {
          name: 'Tag2',
          slug: 'tag1',
        })
      ).rejects.toThrow('already exists');
    });

    it('should add tag to contract', async () => {
      const contract = await createContract(prisma, {
        title: 'Test',
        slug: 'test-tag',
        type: ContractType.SERVICE,
        authorId: 'user123',
      });
      const tag = await createContractTag(prisma, {
        name: 'Urgent',
        slug: 'urgent',
      });

      const mapping = await addTagToContract(prisma, contract.id, tag.id);
      expect(mapping.contractId).toBe(contract.id);
      expect(mapping.tagId).toBe(tag.id);
    });

    it('should get tags for contract', async () => {
      const contract = await createContract(prisma, {
        title: 'Test',
        slug: 'test-tags',
        type: ContractType.SERVICE,
        authorId: 'user123',
      });
      const tag1 = await createContractTag(prisma, { name: 'Tag1', slug: 'tag1' });
      const tag2 = await createContractTag(prisma, { name: 'Tag2', slug: 'tag2' });

      await addTagToContract(prisma, contract.id, tag1.id);
      await addTagToContract(prisma, contract.id, tag2.id);

      const tags = await getContractTags(prisma, contract.id);
      expect(tags.length).toBe(2);
    });
  });

  describe('ContractSchedule Model', () => {
    let contractId: string;

    beforeEach(async () => {
      const contract = await createContract(prisma, {
        title: 'Test Contract',
        slug: 'test-schedule',
        type: ContractType.SERVICE,
        authorId: 'user123',
      });
      contractId = contract.id;
    });

    it('should create schedule milestone', async () => {
      const schedule = await createContractSchedule(prisma, {
        contractId,
        milestoneName: 'First Payment',
        dueDate: new Date('2024-12-31'),
      });

      expect(schedule.milestoneName).toBe('First Payment');
      expect(schedule.status).toBe(MilestoneStatus.PENDING);
    });

    it('should complete milestone', async () => {
      const schedule = await createContractSchedule(prisma, {
        contractId,
        milestoneName: 'Deliverable 1',
        dueDate: new Date('2024-12-31'),
      });

      const completed = await completeMilestone(prisma, schedule.id);
      expect(completed.status).toBe(MilestoneStatus.COMPLETED);
      expect(completed.completedAt).toBeDefined();
    });

    it('should get overdue milestones', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      await createContractSchedule(prisma, {
        contractId,
        milestoneName: 'Overdue',
        dueDate: pastDate,
      });

      const overdue = await getOverdueMilestones(prisma, contractId);
      expect(overdue.length).toBe(1);
    });
  });
});

