import { z } from 'zod';
import {
  PRIVILEGE_CATEGORY_VALUES,
  type PrivilegeCategory,
} from '@domain-common/privilegeContracts';

// Privilege node schema centralizes shared constraint logic for graph + seeds.
export const PRIVILEGE_CATEGORIES = PRIVILEGE_CATEGORY_VALUES;

export const PrivilegeNodeSchema = z.object({
  privilegeCode: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[A-Z0-9-]+$/, 'Privilege codes must be uppercase letters, numbers, or hyphens.'),
  name: z.string().min(3).max(160),
  category: z.enum(PRIVILEGE_CATEGORIES),
  description: z.string().min(12).max(4000),
  specialty: z.string().min(2).max(80),
  tags: z.array(z.string().min(2).max(64)).default([]),
  metadata: z.record(z.any()).optional(),
});

export type PrivilegeNode = z.infer<typeof PrivilegeNodeSchema>;

export function normalizePrivilegeCode(code: string): string {
  return code
    .trim()
    .replace(/[\s_/]+/g, '-')
    .replace(/[^A-Za-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase();
}

export function normalizePrivilegeCategory(category: string): PrivilegeCategory {
  const normalized = category.trim().toLowerCase() as PrivilegeCategory;

  if (!PRIVILEGE_CATEGORIES.includes(normalized)) {
    throw new Error(
      `Invalid privilege category "${category}". Expected one of: ${PRIVILEGE_CATEGORIES.join(', ')}`,
    );
  }

  return normalized;
}

export type CreatePrivilegeNodeInput = Omit<PrivilegeNode, 'privilegeCode' | 'category'> & {
  privilegeCode: string;
  category: string;
};

export function buildPrivilegeNode(input: CreatePrivilegeNodeInput): PrivilegeNode {
  const candidate = {
    ...input,
    privilegeCode: normalizePrivilegeCode(input.privilegeCode),
    category: normalizePrivilegeCategory(input.category),
    tags: input.tags ?? [],
  };

  const parsed = PrivilegeNodeSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((error) => `${error.path.join('.')}: ${error.message}`).join('; '));
  }

  return parsed.data;
}

export function indexPrivilegeNodes(nodes: PrivilegeNode[]): Map<string, PrivilegeNode> {
  const index = new Map<string, PrivilegeNode>();
  for (const node of nodes) {
    if (index.has(node.privilegeCode)) {
      throw new Error(`Duplicate privilegeCode detected: ${node.privilegeCode}`);
    }
    index.set(node.privilegeCode, node);
  }
  return index;
}

export function groupNodesBySpecialty(nodes: PrivilegeNode[]): Record<string, PrivilegeNode[]> {
  return nodes.reduce<Record<string, PrivilegeNode[]>>((acc, node) => {
    const bucket = acc[node.specialty] ?? [];
    bucket.push(node);
    acc[node.specialty] = bucket;
    return acc;
  }, {});
}

