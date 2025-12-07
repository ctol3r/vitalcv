/**
 * B231A-CON-002: ContractTemplate Model Tests
 */

import { PrismaClient } from '@prisma/client';
import {
  createContractTemplate,
  getContractTemplate,
  listContractTemplates,
  updateContractTemplate,
  deleteContractTemplate,
  renderTemplate,
  validateTemplateContent,
  validateVersion,
} from '../models/ContractTemplate.js';

describe('ContractTemplate Model', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.contractTemplate.deleteMany({});
  });

  describe('createContractTemplate', () => {
    it('should create a contract template with required fields', async () => {
      const input = {
        name: 'Partner Agreement',
        content: 'This is a contract between {{orgName}} and {{counterpartyName}}.',
      };

      const template = await createContractTemplate(prisma, input);

      expect(template).toBeDefined();
      expect(template.id).toBeDefined();
      expect(template.name).toBe(input.name);
      expect(template.content).toBe(input.content);
      expect(template.language).toBe('en');
      expect(template.version).toBe('1.0.0');
    });

    it('should create a template with all optional fields', async () => {
      const input = {
        name: 'Service Agreement',
        description: 'Standard service agreement template',
        language: 'en',
        content: 'Service agreement for {{serviceName}}.',
        version: '2.1.0',
        createdBy: 'user123',
      };

      const template = await createContractTemplate(prisma, input);

      expect(template.description).toBe(input.description);
      expect(template.language).toBe(input.language);
      expect(template.version).toBe(input.version);
      expect(template.createdBy).toBe(input.createdBy);
    });
  });

  describe('validateTemplateContent', () => {
    it('should throw error for empty content', () => {
      expect(() => validateTemplateContent('')).toThrow('Template content cannot be empty');
      expect(() => validateTemplateContent('   ')).toThrow('Template content cannot be empty');
    });

    it('should accept valid content', () => {
      expect(() => validateTemplateContent('Valid content')).not.toThrow();
      expect(() => validateTemplateContent('Content with {{placeholder}}')).not.toThrow();
    });
  });

  describe('validateVersion', () => {
    it('should accept valid semantic versions', () => {
      expect(() => validateVersion('1.0.0')).not.toThrow();
      expect(() => validateVersion('2.1.3')).not.toThrow();
      expect(() => validateVersion('10.20.30')).not.toThrow();
    });

    it('should reject invalid versions', () => {
      expect(() => validateVersion('1.0')).toThrow();
      expect(() => validateVersion('v1.0.0')).toThrow();
      expect(() => validateVersion('1.0.0.0')).toThrow();
      expect(() => validateVersion('invalid')).toThrow();
    });
  });

  describe('getContractTemplate', () => {
    it('should retrieve a template by ID', async () => {
      const created = await createContractTemplate(prisma, {
        name: 'Test Template',
        content: 'Test content',
      });

      const retrieved = await getContractTemplate(prisma, created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe(created.name);
    });

    it('should return null for non-existent template', async () => {
      const retrieved = await getContractTemplate(prisma, 'non-existent-id');
      expect(retrieved).toBeNull();
    });
  });

  describe('listContractTemplates', () => {
    it('should list all templates', async () => {
      await createContractTemplate(prisma, {
        name: 'Template 1',
        content: 'Content 1',
      });
      await createContractTemplate(prisma, {
        name: 'Template 2',
        content: 'Content 2',
      });

      const templates = await listContractTemplates(prisma);

      expect(templates.length).toBe(2);
    });

    it('should filter by language', async () => {
      await createContractTemplate(prisma, {
        name: 'English Template',
        language: 'en',
        content: 'English content',
      });
      await createContractTemplate(prisma, {
        name: 'Spanish Template',
        language: 'es',
        content: 'Spanish content',
      });

      const englishTemplates = await listContractTemplates(prisma, { language: 'en' });
      expect(englishTemplates.length).toBe(1);
      expect(englishTemplates[0].language).toBe('en');
    });

    it('should filter by name', async () => {
      await createContractTemplate(prisma, {
        name: 'Partner Agreement',
        content: 'Content',
      });
      await createContractTemplate(prisma, {
        name: 'Service Agreement',
        content: 'Content',
      });

      const filtered = await listContractTemplates(prisma, { name: 'Partner' });
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Partner Agreement');
    });
  });

  describe('updateContractTemplate', () => {
    it('should update template fields', async () => {
      const created = await createContractTemplate(prisma, {
        name: 'Original Name',
        content: 'Original content',
      });

      const updated = await updateContractTemplate(prisma, created.id, {
        name: 'Updated Name',
        content: 'Updated content',
        version: '2.0.0',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.content).toBe('Updated content');
      expect(updated.version).toBe('2.0.0');
    });
  });

  describe('deleteContractTemplate', () => {
    it('should delete a template', async () => {
      const created = await createContractTemplate(prisma, {
        name: 'To Delete',
        content: 'Content',
      });

      await deleteContractTemplate(prisma, created.id);

      const retrieved = await getContractTemplate(prisma, created.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('renderTemplate', () => {
    it('should replace placeholders with variables', () => {
      const template = {
        id: '1',
        name: 'Test',
        description: null,
        language: 'en',
        content: 'Contract between {{orgName}} and {{counterpartyName}}.',
        version: '1.0.0',
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const rendered = renderTemplate(template, {
        orgName: 'Acme Corp',
        counterpartyName: 'Beta Inc',
      });

      expect(rendered).toBe('Contract between Acme Corp and Beta Inc.');
    });

    it('should handle multiple occurrences of same placeholder', () => {
      const template = {
        id: '1',
        name: 'Test',
        description: null,
        language: 'en',
        content: '{{orgName}} agrees to work with {{orgName}}.',
        version: '1.0.0',
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const rendered = renderTemplate(template, {
        orgName: 'Acme Corp',
      });

      expect(rendered).toBe('Acme Corp agrees to work with Acme Corp.');
    });
  });
});

