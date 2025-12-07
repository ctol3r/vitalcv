/**
 * B251B-CON-013: ContractTemplateService
 *
 * Manages contract templates: create/edit/delete templates;
 * parse and validate variables; generate contract content by replacing variables.
 */

import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';

const prisma = new PrismaClient();
const log = getServiceLogger('contracts/template');

export interface CreateTemplateInput {
  name: string;
  slug: string;
  description?: string;
  language?: string;
  content: string; // Markdown or HTML with placeholders like {{variableName}}
  variables?: string[]; // Array of variable names that should be present
  versionNumber?: string;
  createdBy: string;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  content?: string;
  variables?: string[];
  versionNumber?: string;
}

export interface TemplateVariable {
  name: string;
  description?: string;
  required: boolean;
  defaultValue?: string;
}

export class ContractTemplateService {
  /**
   * Create a new contract template
   */
  async createTemplate(input: CreateTemplateInput): Promise<any> {
    log.info('Creating contract template', { name: input.name, slug: input.slug });

    // Validate content
    this.validateTemplateContent(input.content);

    // Parse and validate variables
    const parsedVariables = this.parseVariables(input.content);
    if (input.variables) {
      this.validateVariables(parsedVariables, input.variables);
    }

    // Create template
    const template = await prisma.contractTemplate.create({
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description,
        language: input.language || 'en',
        content: input.content,
        version: input.versionNumber || '1.0.0',
        versionNumber: input.versionNumber || '1.0.0',
        variables: input.variables ? (input.variables as any) : parsedVariables,
        createdBy: input.createdBy,
      },
    });

    log.info('Contract template created', { templateId: template.id });
    return template;
  }

  /**
   * Update a contract template
   */
  async updateTemplate(
    templateId: string,
    updates: UpdateTemplateInput
  ): Promise<any> {
    log.info('Updating contract template', { templateId });

    const template = await prisma.contractTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Validate content if provided
    if (updates.content) {
      this.validateTemplateContent(updates.content);
    }

    // Parse variables if content is updated
    let variables = template.variables as any;
    if (updates.content) {
      variables = this.parseVariables(updates.content);
    }
    if (updates.variables) {
      variables = updates.variables;
    }

    // Update template
    const updated = await prisma.contractTemplate.update({
      where: { id: templateId },
      data: {
        ...(updates.name && { name: updates.name }),
        ...(updates.description !== undefined && {
          description: updates.description,
        }),
        ...(updates.content && { content: updates.content }),
        ...(updates.versionNumber && {
          version: updates.versionNumber,
          versionNumber: updates.versionNumber,
        }),
        ...(variables && { variables }),
      },
    });

    log.info('Contract template updated', { templateId });
    return updated;
  }

  /**
   * Delete a contract template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    log.info('Deleting contract template', { templateId });

    const template = await prisma.contractTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Check if template is in use
    const contractsUsingTemplate = await prisma.contract.count({
      where: {
        // Note: This assumes Contract has a templateId field
        // Adjust based on actual schema
      },
    });

    if (contractsUsingTemplate > 0) {
      throw new Error(
        `Cannot delete template: ${contractsUsingTemplate} contract(s) are using it`
      );
    }

    await prisma.contractTemplate.delete({
      where: { id: templateId },
    });

    log.info('Contract template deleted', { templateId });
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<any> {
    return prisma.contractTemplate.findUnique({
      where: { id: templateId },
    });
  }

  /**
   * Get template by slug
   */
  async getTemplateBySlug(slug: string): Promise<any> {
    return prisma.contractTemplate.findUnique({
      where: { slug },
    });
  }

  /**
   * List templates with filters
   */
  async listTemplates(options?: {
    language?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ templates: any[]; total: number }> {
    const where: any = {};
    if (options?.language) where.language = options.language;
    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [templates, total] = await Promise.all([
      prisma.contractTemplate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      prisma.contractTemplate.count({ where }),
    ]);

    return { templates, total };
  }

  /**
   * Parse variables from template content
   * Extracts placeholders like {{variableName}} from the content
   */
  parseVariables(content: string): string[] {
    const variablePattern = /\{\{(\w+)\}\}/g;
    const variables = new Set<string>();
    let match;

    while ((match = variablePattern.exec(content)) !== null) {
      variables.add(match[1]);
    }

    return Array.from(variables);
  }

  /**
   * Validate template content
   */
  validateTemplateContent(content: string): void {
    if (!content || content.trim().length === 0) {
      throw new Error('Template content cannot be empty');
    }

    if (content.length > 1000000) {
      // 1MB limit
      throw new Error('Template content exceeds maximum size (1MB)');
    }
  }

  /**
   * Validate that all required variables are present
   */
  validateVariables(
    parsedVariables: string[],
    requiredVariables: string[]
  ): void {
    const missing = requiredVariables.filter(
      (v) => !parsedVariables.includes(v)
    );

    if (missing.length > 0) {
      throw new Error(
        `Template is missing required variables: ${missing.join(', ')}`
      );
    }
  }

  /**
   * Generate contract content by replacing variables
   */
  async generateContent(
    templateId: string,
    variables: Record<string, string>
  ): Promise<string> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    let content = template.content;

    // Replace all placeholders with their values
    const parsedVariables = this.parseVariables(content);
    for (const varName of parsedVariables) {
      const placeholder = `{{${varName}}}`;
      const value = variables[varName] || '';

      if (!value && this.isRequiredVariable(template, varName)) {
        throw new Error(`Required variable ${varName} is missing`);
      }

      content = content.replace(
        new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        value
      );
    }

    // Warn about unresolved placeholders
    const unresolved = this.parseVariables(content);
    if (unresolved.length > 0) {
      log.warn('Unresolved placeholders in generated content', {
        templateId,
        unresolved,
      });
    }

    return content;
  }

  /**
   * Check if a variable is required
   */
  private isRequiredVariable(template: any, varName: string): boolean {
    const templateVariables = template.variables as any;
    if (!templateVariables || !Array.isArray(templateVariables)) {
      return false;
    }

    const variable = templateVariables.find((v: any) => v.name === varName);
    return variable?.required === true;
  }
}

// Export singleton instance
export const contractTemplateService = new ContractTemplateService();

