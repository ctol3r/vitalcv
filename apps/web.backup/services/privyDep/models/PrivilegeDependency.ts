import { z } from 'zod';
import { normalizePrivilegeCode } from './PrivilegeNode';

export const PRIVILEGE_DEPENDENCY_TYPES = [
  'REQUIRES',
  'ENHANCES',
  'CONFLICTS_WITH',
  'MUTUALLY_EXCLUSIVE',
] as const;

export type PrivilegeDependencyType = (typeof PRIVILEGE_DEPENDENCY_TYPES)[number];

export const PrivilegeDependencySchema = z
  .object({
    parentPrivilegeCode: z
      .string()
      .min(3)
      .max(80)
      .regex(/^[A-Z0-9-]+$/),
    childPrivilegeCode: z
      .string()
      .min(3)
      .max(80)
      .regex(/^[A-Z0-9-]+$/),
    dependencyType: z.enum(PRIVILEGE_DEPENDENCY_TYPES),
    rationale: z.string().min(6).max(4000).optional(),
  })
  .refine((value) => value.parentPrivilegeCode !== value.childPrivilegeCode, {
    message: 'A privilege cannot depend on itself.',
    path: ['childPrivilegeCode'],
  });

export type PrivilegeDependency = z.infer<typeof PrivilegeDependencySchema>;

export type CreatePrivilegeDependencyInput = Omit<
  PrivilegeDependency,
  'parentPrivilegeCode' | 'childPrivilegeCode'
> & {
  parentPrivilegeCode: string;
  childPrivilegeCode: string;
};

export function buildPrivilegeDependency(input: CreatePrivilegeDependencyInput): PrivilegeDependency {
  const candidate = {
    ...input,
    parentPrivilegeCode: normalizePrivilegeCode(input.parentPrivilegeCode),
    childPrivilegeCode: normalizePrivilegeCode(input.childPrivilegeCode),
    dependencyType: input.dependencyType,
    rationale: input.rationale?.trim(),
  };

  const parsed = PrivilegeDependencySchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((error) => `${error.path.join('.')}: ${error.message}`).join('; '));
  }

  return parsed.data;
}

export function dependencyKey(edge: PrivilegeDependency): string {
  return `${edge.parentPrivilegeCode}->${edge.childPrivilegeCode}:${edge.dependencyType}`;
}

export function dedupeDependencies(
  dependencies: PrivilegeDependency[],
  strategy: 'first-wins' | 'last-wins' = 'last-wins',
): PrivilegeDependency[] {
  const seen = new Map<string, PrivilegeDependency>();
  for (const dependency of dependencies) {
    const key = dependencyKey(dependency);
    if (strategy === 'last-wins' || !seen.has(key)) {
      seen.set(key, dependency);
    }
  }
  return Array.from(seen.values());
}

