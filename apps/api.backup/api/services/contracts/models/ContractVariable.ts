/**
 * B251A-CON-005: ContractVariable Model
 *
 * Defines variables for templates: id, templateId (FK), name, description,
 * valueType (string/date/number), required (boolean), defaultValue (nullable)
 */

import { PrismaClient, VariableValueType } from '@prisma/client';

export interface ContractVariableInput {
  templateId: string;
  name: string;
  description?: string;
  valueType?: VariableValueType;
  required?: boolean;
  defaultValue?: string;
}

export interface ContractVariable {
  id: string;
  templateId: string;
  name: string;
  description: string | null;
  valueType: VariableValueType;
  required: boolean;
  defaultValue: string | null;
}

/**
 * Validate variable name format
 */
export function validateVariableName(name: string): void {
  const namePattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  if (!namePattern.test(name)) {
    throw new Error(
      'Variable name must start with a letter or underscore and contain only alphanumeric characters and underscores'
    );
  }
}

/**
 * Create a new contract variable
 */
export async function createContractVariable(
  prisma: PrismaClient,
  input: ContractVariableInput
): Promise<ContractVariable> {
  validateVariableName(input.name);

  // Verify template exists
  const template = await prisma.contractTemplate.findUnique({
    where: { id: input.templateId },
  });
  if (!template) {
    throw new Error(`Template with id "${input.templateId}" not found`);
  }

  // Check if variable name already exists for this template
  const existing = await prisma.contractVariable.findUnique({
    where: {
      templateId_name: {
        templateId: input.templateId,
        name: input.name,
      },
    },
  });
  if (existing) {
    throw new Error(`Variable "${input.name}" already exists for template ${input.templateId}`);
  }

  return prisma.contractVariable.create({
    data: {
      templateId: input.templateId,
      name: input.name,
      description: input.description || null,
      valueType: input.valueType || VariableValueType.STRING,
      required: input.required !== undefined ? input.required : false,
      defaultValue: input.defaultValue || null,
    },
  });
}

/**
 * Get contract variable by ID
 */
export async function getContractVariable(
  prisma: PrismaClient,
  variableId: string
): Promise<ContractVariable | null> {
  return prisma.contractVariable.findUnique({
    where: { id: variableId },
  });
}

/**
 * List variables for a template
 */
export async function listContractVariables(
  prisma: PrismaClient,
  templateId: string
): Promise<ContractVariable[]> {
  return prisma.contractVariable.findMany({
    where: { templateId },
    orderBy: { name: 'asc' },
  });
}

/**
 * Update contract variable
 */
export async function updateContractVariable(
  prisma: PrismaClient,
  variableId: string,
  updates: Partial<Omit<ContractVariableInput, 'templateId' | 'name'>>
): Promise<ContractVariable> {
  return prisma.contractVariable.update({
    where: { id: variableId },
    data: {
      ...(updates.description !== undefined && { description: updates.description || null }),
      ...(updates.valueType && { valueType: updates.valueType }),
      ...(updates.required !== undefined && { required: updates.required }),
      ...(updates.defaultValue !== undefined && { defaultValue: updates.defaultValue || null }),
    },
  });
}

/**
 * Delete contract variable
 */
export async function deleteContractVariable(
  prisma: PrismaClient,
  variableId: string
): Promise<void> {
  await prisma.contractVariable.delete({
    where: { id: variableId },
  });
}

