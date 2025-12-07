/**
 * B231A-CON-002 / B251A-CON-004: ContractTemplate Model
 *
 * Stores reusable templates: id, name, slug, description, content (template with variables),
 * variables (JSON array of variable names), versionNumber, createdAt, updatedAt
 */

import { PrismaClient } from '@prisma/client';

export interface ContractTemplateInput {
  name: string;
  slug: string; // B251A-CON-004: Added slug for uniqueness
  description?: string;
  language?: string; // ISO 639-1 language code, defaults to 'en'
  content: string; // Template with variables (e.g., {{orgName}}, {{counterpartyName}})
  variables?: string[]; // B251A-CON-004: JSON array of variable names
  version?: string; // Semantic version, defaults to '1.0.0'
  createdBy?: string; // User ID who created the template
}

export interface ContractTemplate {
  id: string;
  name: string;
  slug: string; // B251A-CON-004: Added slug
  description: string | null;
  language: string;
  content: string;
  variables: any | null; // B251A-CON-004: JSON array of variable names
  version: string; // Legacy field
  versionNumber: string; // B251A-CON-004: Alias for version
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate template content contains valid placeholders
 */
export function validateTemplateContent(content: string): void {
  if (!content || content.trim().length === 0) {
    throw new Error('Template content cannot be empty');
  }

  // Check for common placeholder patterns
  const placeholderPattern = /\{\{[\w]+\}\}/g;
  const placeholders = content.match(placeholderPattern);
  if (!placeholders || placeholders.length === 0) {
    // Warning: template has no placeholders, but not an error
    console.warn('Template content has no placeholders');
  }
}

/**
 * Validate semantic version format
 */
export function validateVersion(version: string): void {
  const semverPattern = /^\d+\.\d+\.\d+$/;
  if (!semverPattern.test(version)) {
    throw new Error(`Invalid version format: ${version}. Expected format: X.Y.Z`);
  }
}

/**
 * Validate slug format (alphanumeric, hyphens, underscores)
 */
export function validateTemplateSlug(slug: string): void {
  const slugPattern = /^[a-z0-9_-]+$/;
  if (!slugPattern.test(slug)) {
    throw new Error(
      'Invalid slug format. Use only lowercase letters, numbers, hyphens, and underscores.'
    );
  }
}

/**
 * Create a new contract template
 */
export async function createContractTemplate(
  prisma: PrismaClient,
  input: ContractTemplateInput
): Promise<ContractTemplate> {
  validateTemplateContent(input.content);
  validateTemplateSlug(input.slug);

  const version = input.version || '1.0.0';
  if (input.version) {
    validateVersion(version);
  }

  // Check if slug already exists
  const existing = await prisma.contractTemplate.findUnique({
    where: { slug: input.slug },
  });
  if (existing) {
    throw new Error(`Template with slug "${input.slug}" already exists`);
  }

  return prisma.contractTemplate.create({
    data: {
      name: input.name,
      slug: input.slug, // B251A-CON-004: Added slug
      description: input.description ?? null,
      language: input.language || 'en',
      content: input.content,
      variables: input.variables ? JSON.parse(JSON.stringify(input.variables)) : null, // B251A-CON-004: Added variables
      version,
      versionNumber: version, // B251A-CON-004: Added versionNumber
      createdBy: input.createdBy ?? null,
    },
  });
}

/**
 * Get contract template by ID
 */
export async function getContractTemplate(
  prisma: PrismaClient,
  templateId: string
): Promise<ContractTemplate | null> {
  return prisma.contractTemplate.findUnique({
    where: { id: templateId },
  });
}

/**
 * Get contract template by slug
 */
export async function getContractTemplateBySlug(
  prisma: PrismaClient,
  slug: string
): Promise<ContractTemplate | null> {
  return prisma.contractTemplate.findUnique({
    where: { slug },
  });
}

/**
 * List contract templates with optional filters
 */
export async function listContractTemplates(
  prisma: PrismaClient,
  options?: {
    language?: string;
    name?: string;
    slug?: string;
    createdBy?: string;
  }
): Promise<ContractTemplate[]> {
  const where: any = {};

  if (options?.language) {
    where.language = options.language;
  }
  if (options?.name) {
    where.name = { contains: options.name, mode: 'insensitive' };
  }
  if (options?.slug) {
    where.slug = { contains: options.slug, mode: 'insensitive' };
  }
  if (options?.createdBy) {
    where.createdBy = options.createdBy;
  }

  return prisma.contractTemplate.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Update contract template
 */
export async function updateContractTemplate(
  prisma: PrismaClient,
  templateId: string,
  updates: Partial<ContractTemplateInput>
): Promise<ContractTemplate> {
  if (updates.content) {
    validateTemplateContent(updates.content);
  }
  if (updates.version) {
    validateVersion(updates.version);
  }
  if (updates.slug) {
    validateTemplateSlug(updates.slug);
    // Check if slug is taken by another template
    const existing = await prisma.contractTemplate.findUnique({
      where: { slug: updates.slug },
    });
    if (existing && existing.id !== templateId) {
      throw new Error(`Template with slug "${updates.slug}" already exists`);
    }
  }

  const version = updates.version || undefined;
  const data: any = {
    ...(updates.name && { name: updates.name }),
    ...(updates.description !== undefined && { description: updates.description ?? null }),
    ...(updates.language && { language: updates.language }),
    ...(updates.content && { content: updates.content }),
    ...(updates.slug && { slug: updates.slug }), // B251A-CON-004: Added slug update
    ...(updates.variables !== undefined && { variables: updates.variables ? JSON.parse(JSON.stringify(updates.variables)) : null }), // B251A-CON-004: Added variables update
  };

  if (version) {
    data.version = version;
    data.versionNumber = version; // B251A-CON-004: Update versionNumber too
  }

  return prisma.contractTemplate.update({
    where: { id: templateId },
    data,
  });
}

/**
 * Delete contract template
 */
export async function deleteContractTemplate(
  prisma: PrismaClient,
  templateId: string
): Promise<void> {
  await prisma.contractTemplate.delete({
    where: { id: templateId },
  });
}

/**
 * Render template with placeholders replaced
 */
export function renderTemplate(
  template: ContractTemplate,
  variables: Record<string, string>
): string {
  let rendered = template.content;

  // Replace all placeholders with their values
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    rendered = rendered.replace(new RegExp(placeholder, 'g'), value);
  }

  // Warn about unresolved placeholders
  const unresolvedPlaceholders = rendered.match(/\{\{[\w]+\}\}/g);
  if (unresolvedPlaceholders && unresolvedPlaceholders.length > 0) {
    console.warn(`Unresolved placeholders in template: ${unresolvedPlaceholders.join(', ')}`);
  }

  return rendered;
}

